import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// System/marketing senders to skip before AI analysis
const SKIP_SENDERS = [
  "noreply@", "no-reply@", "mailer-daemon@", "postmaster@",
  "@accounts.google.com", "@uber.com", "@stripe.com", "@siteground.com",
  "@myactivecampaign.com", "@go.autodesk.com", "@tm.openai.com",
  "@sgsitescanner.", "@linkedin.com", "@facebookmail.com",
  "@github.com", "@notify.", "@newsletter.", "@marketing.",
  "@synologynotification.com", "@ringcentral.com", "@lovable.dev",
  "@service.ringcentral.com", "sns@", "@uber.com",
  "service@", "@notifications.", "@alert.",
];

// Internal bot senders to skip (but real team members should pass through)
const SKIP_INTERNAL_BOTS = ["odoobot"];

const INTERNAL_DOMAIN = "@rebar.shop";

// Default RFQ lead assignee when no historical customer assignment exists
const DEFAULT_RFQ_ASSIGNEE = "Neel Mahajan";

// Matching confidence thresholds
const THRESHOLD_AUTO_ROUTE = 0.8;
const THRESHOLD_ESCALATE = 0.4;

interface LeadExtraction {
  is_lead: boolean;
  title: string;
  project_name: string;
  description: string;
  sender_name: string;
  sender_company: string;
  sender_email: string;
  sender_phone: string;
  city: string;
  expected_value: number | null;
  priority: "low" | "medium" | "high";
  reason: string;
}

interface MatchCandidate {
  leadId: string;
  leadTitle: string;
  score: number;
  matchedSignals: string[];
  assignedTo: string | null;
}

// ─── REFERENCE EXTRACTION ────────────────────────────────────────────

const REF_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /S\d{4,5}/g, label: "S-number" },
  { pattern: /RFQ-?\d+/gi, label: "RFQ" },
  { pattern: /RFI-?\d+/gi, label: "RFI" },
  { pattern: /Job\s*#?\s*\d+/gi, label: "Job" },
  { pattern: /Project\s*#?\s*\d+/gi, label: "Project" },
  { pattern: /PO-?\d+/gi, label: "PO" },
  { pattern: /Quote-?\d+/gi, label: "Quote" },
  { pattern: /\b\d{2}-\d{4,6}\b/g, label: "ContractorRef" },
];

function extractReferences(subject: string, body: string): string[] {
  const text = `${subject} ${(body || "").substring(0, 3000)}`;
  const refs = new Set<string>();
  for (const { pattern } of REF_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      refs.add(m[0].toUpperCase().replace(/\s+/g, ""));
    }
  }
  return [...refs];
}

// ─── SUBJECT SIMILARITY (Jaccard) ────────────────────────────────────

function stripPrefixes(subject: string): string {
  return subject.replace(/^(Re|Fw|Fwd|RE|FW|FWD)\s*:\s*/gi, "").trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(t => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) { if (b.has(t)) intersection++; }
  return intersection / (a.size + b.size - intersection);
}

// ─── MULTI-SIGNAL SCORING ENGINE ─────────────────────────────────────

function scoreEmailAgainstLeads(
  email: {
    threadId: string | null;
    inReplyTo: string | null;
    references: string[];
    senderEmail: string;
    subject: string;
    body: string;
    attachmentFilenames: string[];
  },
  leads: Array<{
    id: string;
    title: string;
    customer_id: string | null;
    notes: string | null;
    metadata: Record<string, unknown> | null;
  }>,
  commsForLeads: Map<string, Array<{ threadId: string | null; sourceId: string }>>,
  emailToCustomerId: Map<string, string>,
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const emailRefs = extractReferences(email.subject, email.body);
  const emailSubjectTokens = tokenize(stripPrefixes(email.subject));
  const senderCustId = emailToCustomerId.get(email.senderEmail.toLowerCase().trim());

  for (const lead of leads) {
    let score = 0;
    const signals: string[] = [];
    const leadComms = commsForLeads.get(lead.id) || [];
    const leadMeta = lead.metadata || {};

    // ── Signal 1: Gmail thread_id match (0.95) ──
    if (email.threadId) {
      // Check if any comm linked to this lead shares the same thread
      const threadMatch = leadComms.some(c => c.threadId === email.threadId);
      // Also check lead metadata
      const metaThreadMatch = leadMeta.thread_id === email.threadId;
      if (threadMatch || metaThreadMatch) {
        score = Math.max(score, 0.95);
        signals.push("thread_id");
      }
    }

    // Short-circuit if thread match — near-deterministic
    if (score >= 0.95) {
      const assignMatch = lead.notes?.match(/Assigned:\s*([^|\n]+)/);
      candidates.push({ leadId: lead.id, leadTitle: lead.title, score, matchedSignals: signals, assignedTo: assignMatch?.[1]?.trim() || null });
      continue;
    }

    // ── Signal 2: In-Reply-To / References header match (0.90) ──
    if (email.inReplyTo || email.references.length > 0) {
      const headerIds = new Set([email.inReplyTo, ...email.references].filter(Boolean) as string[]);
      const leadMessageIds = (leadMeta.email_message_ids as string[]) || [];
      const leadSourceIds = new Set(leadComms.map(c => c.sourceId));
      
      for (const hid of headerIds) {
        if (leadSourceIds.has(hid) || leadMessageIds.includes(hid)) {
          score = Math.max(score, 0.90);
          signals.push("in_reply_to");
          break;
        }
      }
    }

    // Short-circuit if header match
    if (score >= 0.90) {
      const assignMatch = lead.notes?.match(/Assigned:\s*([^|\n]+)/);
      candidates.push({ leadId: lead.id, leadTitle: lead.title, score, matchedSignals: signals, assignedTo: assignMatch?.[1]?.trim() || null });
      continue;
    }

    // ── Signal 3: RFQ/Job reference match (0.50) ──
    if (emailRefs.length > 0) {
      const leadExternalRefs = (leadMeta.external_refs as string[]) || [];
      const leadTitle = lead.title.toUpperCase();
      const leadNotes = (lead.notes || "").toUpperCase();
      const leadRfqRef = ((leadMeta.rfq_ref as string) || "").toUpperCase();

      for (const ref of emailRefs) {
        if (
          leadTitle.includes(ref) ||
          leadNotes.includes(ref) ||
          leadRfqRef === ref ||
          leadExternalRefs.map(r => r.toUpperCase()).includes(ref)
        ) {
          score = Math.max(score, 0.50);
          signals.push(`ref:${ref}`);
          break;
        }
      }
    }

    // ── Signal 4: Sender email → same customer (0.40) ──
    if (senderCustId && lead.customer_id === senderCustId) {
      score = Math.max(score, 0.40);
      signals.push("sender_customer");
    }

    // ── Signal 5: Subject similarity (0.30) ──
    const leadTitleTokens = tokenize(lead.title);
    const jaccard = jaccardSimilarity(emailSubjectTokens, leadTitleTokens);
    if (jaccard > 0.3) {
      const subjectScore = 0.30 * jaccard;
      score = Math.max(score, subjectScore);
      signals.push(`subject_sim:${jaccard.toFixed(2)}`);
    }

    // ── Signal 6: Attachment filename match (0.20) ──
    if (email.attachmentFilenames.length > 0) {
      const leadFiles = (leadMeta.files as Array<{ filename?: string }>) || [];
      const leadFilenames = new Set(leadFiles.map(f => (f.filename || "").toLowerCase()));
      for (const fn of email.attachmentFilenames) {
        if (leadFilenames.has(fn.toLowerCase())) {
          score = Math.max(score, 0.20);
          signals.push(`attachment:${fn}`);
          break;
        }
      }
    }

    // ── Combine: boost if multiple weak signals fire together ──
    // If sender_customer + subject_sim both fire, combine additively (capped at 0.75)
    if (signals.includes("sender_customer") && signals.some(s => s.startsWith("subject_sim"))) {
      const combined = Math.min(0.75, 0.40 + 0.30 * jaccard);
      score = Math.max(score, combined);
    }
    // If sender_customer + ref both fire, boost
    if (signals.includes("sender_customer") && signals.some(s => s.startsWith("ref:"))) {
      score = Math.max(score, 0.85);
    }

    if (score > 0 && signals.length > 0) {
      const assignMatch = lead.notes?.match(/Assigned:\s*([^|\n]+)/);
      candidates.push({ leadId: lead.id, leadTitle: lead.title, score, matchedSignals: signals, assignedTo: assignMatch?.[1]?.trim() || null });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * AI-analyze an email and extract structured lead data
 */
async function analyzeEmailWithAI(
  subject: string,
  from: string,
  body: string
): Promise<LeadExtraction> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const prompt = `You are an AI assistant for REBAR SHOP — a rebar fabrication company in Ontario, Canada. Analyze this email and determine if it's a legitimate business lead.

EMAIL:
From: ${from}
Subject: ${subject}
Body:
${(body || "").substring(0, 4000)}

Analyze and extract information using the suggest_lead tool.

An email IS a lead if it matches ANY of these criteria:
- Requests a quote, quotation, pricing, estimate, or bid for rebar/steel/fabrication work
- Contains words like "quote", "quotation", "pricing", "price", "bid", "tender", "RFQ", "estimation", "estimate", "proposal", "budget", "cost"
- Forwards or references attached drawings, plans, specifications, shop drawings, or bid documents
- Inquires about services, projects, or capabilities for rebar/steel/construction
- Is from a construction company, contractor, engineer, or supplier asking about rebar
- Contains project details, drawings, specifications, or download links for bid packages
- Asks about availability, pricing, or timelines for rebar work
- References a bid invitation, tender notice, or construction opportunity
- Contains attachments like PDFs, DWGs, or spreadsheets related to construction/rebar
- Even brief emails like "quotation please" or "please quote" or "need pricing" ARE leads

IMPORTANT: When in doubt, classify as a lead (is_lead = true). It's better to capture a borderline email than miss a real opportunity. Only classify as NOT a lead if it's clearly spam, marketing, newsletters, receipts, system notifications, job applications, or purely internal communication with zero business context.

NAMING CONVENTION: Create a short project name like "Halford Avenue Project" or "TTC College Pole Bases" or "Rebar Quote" — concise, descriptive, based on project/site name from the email.

Extract the sender's COMPANY NAME as precisely as possible. Look in email signature, domain, body text. Use full legal/trade name if visible (e.g., "BRONTE CONSTRUCTION (2220742 Ontario Ltd.)" not just "Bronte").`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_lead",
            description: "Extract lead information from an email",
            parameters: {
              type: "object",
              properties: {
                is_lead: { type: "boolean", description: "Whether this email is a legitimate business lead/RFQ" },
                title: { type: "string", description: "Short project/opportunity name (e.g., 'Halford Avenue Project', 'TTC College Pole Bases')" },
                project_name: { type: "string", description: "Full project/site name if mentioned" },
                description: { type: "string", description: "Brief summary of what the customer is requesting" },
                sender_name: { type: "string", description: "Full name of the person who sent the email" },
                sender_company: { type: "string", description: "Company name of the sender — use full legal/trade name from signature if available" },
                sender_email: { type: "string", description: "Email address of the sender" },
                sender_phone: { type: "string", description: "Phone number from signature if available, empty string otherwise" },
                city: { type: "string", description: "City or location of the project if mentioned, empty string otherwise" },
                expected_value: { type: "number", description: "Estimated deal value in dollars if mentioned or estimatable, null otherwise" },
                priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority based on urgency, deal size, and specificity" },
                reason: { type: "string", description: "Brief reason for the classification decision" },
              },
              required: ["is_lead", "title", "project_name", "description", "sender_name", "sender_company", "sender_email", "sender_phone", "city", "priority", "reason"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "suggest_lead" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI analysis failed:", response.status, errorText);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("AI did not return structured output");

  return JSON.parse(toolCall.function.arguments) as LeadExtraction;
}

function shouldSkipSender(from: string, to: string): boolean {
  const lowerFrom = from.toLowerCase();

  if (SKIP_SENDERS.some((pattern) => lowerFrom.includes(pattern))) return true;

  // Block ALL outgoing/internal emails from @rebar.shop — team members are senders, not leads
  if (lowerFrom.includes(INTERNAL_DOMAIN)) {
    return true;
  }

  return false;
}

function findMatchingCustomer(
  companyName: string,
  customers: Array<{ id: string; name: string; company_name: string | null }>
): { id: string; name: string; company_name: string | null } | null {
  if (!companyName || companyName.trim() === "") return null;

  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\b(inc|ltd|llc|corp|construction|contracting|limited|group|projects)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const target = normalize(companyName);
  if (!target) return null;

  let bestMatch: typeof customers[0] | null = null;
  let bestScore = 0;

  for (const customer of customers) {
    const candidateName = normalize(customer.company_name || customer.name);
    if (!candidateName) continue;

    if (candidateName === target) return customer;

    if (candidateName.includes(target) || target.includes(candidateName)) {
      const score = Math.min(candidateName.length, target.length) / Math.max(candidateName.length, target.length);
      if (score > bestScore) { bestScore = score; bestMatch = customer; }
    }

    const targetTokens = new Set(target.split(" ").filter(t => t.length > 2));
    const candidateTokens = new Set(candidateName.split(" ").filter(t => t.length > 2));
    if (targetTokens.size > 0 && candidateTokens.size > 0) {
      let overlap = 0;
      for (const t of targetTokens) { if (candidateTokens.has(t)) overlap++; }
      const score = (2 * overlap) / (targetTokens.size + candidateTokens.size);
      if (score > bestScore) { bestScore = score; bestMatch = customer; }
    }
  }

  return bestScore >= 0.5 ? bestMatch : null;
}

async function getNextLeadNumber(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from("leads")
    .select("title")
    .like("title", "S%")
    .order("created_at", { ascending: false })
    .limit(200);

  let maxNum = 0;
  for (const lead of data || []) {
    const match = lead.title.match(/^S(\d{4,5})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `S${String(maxNum + 1).padStart(5, "0")}`;
}

function extractFileLinks(body: string): string[] {
  if (!body) return [];
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const allUrls = body.match(urlRegex) || [];

  const filePatterns = [
    /dropbox\.com/i, /drive\.google\.com/i, /docs\.google\.com/i,
    /onedrive\.live\.com/i, /sharepoint\.com/i, /wetransfer\.com/i,
    /we\.tl\//i, /box\.com/i, /mediafire\.com/i,
    /\.pdf$/i, /\.dwg$/i, /\.dxf$/i, /\.xlsx?$/i, /\.docx?$/i,
    /\.zip$/i, /\.rar$/i, /\.png$/i, /\.jpg$/i, /\.jpeg$/i,
  ];

  return [...new Set(allUrls.filter(url =>
    filePatterns.some(p => p.test(url))
  ))].slice(0, 10);
}

async function downloadAndStoreAttachment(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  messageId: string,
  attachment: { filename: string; mimeType: string; attachmentId: string },
  leadId: string,
): Promise<{ path: string; filename: string; mimeType: string; size: number } | null> {
  try {
    const { data: tokenRow } = await supabaseAdmin
      .from("user_gmail_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokenRow?.refresh_token) return null;

    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRow.refresh_token.replace("jwt:", ""),
        grant_type: "refresh_token",
      }),
    });
    if (!tokenRes.ok) return null;
    const { access_token } = await tokenRes.json();

    const attRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.attachmentId}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!attRes.ok) return null;
    const attData = await attRes.json();

    const base64Data = attData.data.replace(/-/g, "+").replace(/_/g, "/");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const storagePath = `leads/${leadId}/${attachment.filename}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("estimation-files")
      .upload(storagePath, bytes, {
        contentType: attachment.mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }

    return { path: storagePath, filename: attachment.filename, mimeType: attachment.mimeType, size: bytes.length };
  } catch (err) {
    console.error(`Failed to download attachment ${attachment.filename}:`, err);
    return null;
  }
}

// ─── ESCALATION: send email + create human_task ──────────────────────

async function escalateUncertainMatch(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  email: { id: string; from: string; subject: string; snippet: string; sourceEmailId: string },
  topCandidates: MatchCandidate[],
): Promise<void> {
  // 1. Get the Blitz agent id for human_tasks
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("code", "blitz")
    .single();

  if (!agent) {
    console.error("Blitz agent not found for escalation");
    return;
  }

  const candidateList = topCandidates.slice(0, 3).map((c, i) =>
    `${i + 1}. ${c.leadTitle} (score: ${(c.score * 100).toFixed(0)}% — ${c.matchedSignals.join(", ")})`
  ).join("\n");

  const description = [
    `📧 From: ${email.from}`,
    `Subject: ${email.subject}`,
    `Preview: ${email.snippet.substring(0, 300)}`,
    ``,
    `Top candidate leads:`,
    candidateList,
  ].join("\n");

  // 2. Insert human_task
  await supabaseAdmin.from("human_tasks").insert({
    agent_id: agent.id,
    title: "Review: Is this email about an existing project?",
    description,
    severity: "warning",
    status: "open",
    category: "email_routing",
    entity_type: "communication",
    entity_id: email.id,
    dedupe_key: `email_routing_${email.sourceEmailId}`,
    inputs_snapshot: {
      email_id: email.id,
      source_email_id: email.sourceEmailId,
      from: email.from,
      subject: email.subject,
      candidates: topCandidates.slice(0, 3).map(c => ({
        lead_id: c.leadId,
        lead_title: c.leadTitle,
        score: c.score,
        signals: c.matchedSignals,
      })),
    },
  });

  // 3. Send escalation email to neel@rebar.shop via gmail-send
  try {
    const emailBody = `
<div style="font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.7; color: #1a1a1a;">
  <h2 style="color: #d97706;">⚠️ Action Required: Email Routing Review</h2>
  <p>A new email may belong to an existing project. Please review:</p>
  <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p><strong>From:</strong> ${email.from}</p>
    <p><strong>Subject:</strong> ${email.subject}</p>
    <p><strong>Preview:</strong> ${email.snippet.substring(0, 300)}</p>
  </div>
  <h3>Top Candidate Projects:</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr style="background: #f9fafb;">
      <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb;">#</th>
      <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb;">Project</th>
      <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb;">Confidence</th>
      <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb;">Signals</th>
    </tr>
    ${topCandidates.slice(0, 3).map((c, i) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${i + 1}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${c.leadTitle}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${(c.score * 100).toFixed(0)}%</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${c.matchedSignals.join(", ")}</td>
    </tr>`).join("")}
  </table>
  <p style="margin-top: 16px;">Review this in your <a href="https://cusum-brain-flow.lovable.app/pipeline">Pipeline</a> or check the human tasks panel.</p>
</div>`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // We need a user token for gmail-send. Get Neel's user token from profiles.
    const { data: neelProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("full_name", "%neel%")
      .limit(1)
      .maybeSingle();

    if (neelProfile?.user_id) {
      // Use service role to call gmail-send (it validates auth, so we pass service key)
      await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "neel@rebar.shop",
          subject: `[Action Required] New email may belong to existing project — ${email.subject}`,
          body: emailBody,
          sent_by_agent: true,
        }),
      });
    }
  } catch (emailErr) {
    console.error("Failed to send escalation email:", emailErr);
    // Non-fatal — human_task was still created
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch reference data ──
    const { data: allCustomers } = await supabaseAdmin
      .from("customers")
      .select("id, name, company_name")
      .eq("company_id", profile.company_id);
    const customers = allCustomers || [];

    const { data: allContacts } = await supabaseAdmin
      .from("contacts")
      .select("id, email, customer_id")
      .eq("company_id", profile.company_id)
      .not("email", "is", null);
    const contacts = allContacts || [];

    const emailToCustomerId = new Map<string, string>();
    for (const c of contacts) {
      if (c.email) emailToCustomerId.set(c.email.toLowerCase().trim(), c.customer_id!);
    }

    // Fetch active leads with metadata for scoring
    const excludedStages = ["archived", "closed", "loss"];
    const { data: activeLeadsData } = await supabaseAdmin
      .from("leads")
      .select("id, title, customer_id, notes, updated_at, stage, metadata, source_email_id")
      .eq("company_id", profile.company_id)
      .not("stage", "in", `(${excludedStages.join(",")})`)
      .order("updated_at", { ascending: false })
      .limit(500);
    const activeLeads = activeLeadsData || [];

    // Fetch communications linked to active leads (for thread matching)
    const activeLeadIds = activeLeads.filter(l => l.id).map(l => l.id);
    const commsForLeads = new Map<string, Array<{ threadId: string | null; sourceId: string }>>();

    if (activeLeadIds.length > 0) {
      // Batch in chunks of 50 to avoid query limits
      for (let i = 0; i < activeLeadIds.length; i += 50) {
        const chunk = activeLeadIds.slice(i, i + 50);
        const { data: linkedComms } = await supabaseAdmin
          .from("communications")
          .select("lead_id, thread_id, source_id")
          .in("lead_id", chunk)
          .not("lead_id", "is", null);

        for (const comm of linkedComms || []) {
          if (!comm.lead_id) continue;
          if (!commsForLeads.has(comm.lead_id)) commsForLeads.set(comm.lead_id, []);
          commsForLeads.get(comm.lead_id)!.push({ threadId: comm.thread_id, sourceId: comm.source_id });
        }
      }
    }

    // Build thread→lead map for thread-level dedup
    const threadToLeadId = new Map<string, string>();
    for (const [leadId, comms] of commsForLeads.entries()) {
      for (const c of comms) {
        if (c.threadId) threadToLeadId.set(c.threadId, leadId);
      }
    }
    // Also from lead metadata
    for (const lead of activeLeads) {
      const meta = lead.metadata as Record<string, unknown> | null;
      if (meta?.thread_id) threadToLeadId.set(meta.thread_id as string, lead.id);
    }

    // Assignment history
    const { data: assignmentHistory } = await supabaseAdmin
      .from("leads")
      .select("customer_id, notes")
      .eq("company_id", profile.company_id)
      .not("customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(500);

    const customerAssignments = new Map<string, string>();
    for (const lead of assignmentHistory || []) {
      if (lead.customer_id && lead.notes && !customerAssignments.has(lead.customer_id)) {
        const match = lead.notes.match(/Assigned:\s*([^|\n]+)/);
        if (match) customerAssignments.set(lead.customer_id, match[1].trim());
      }
    }

    const { data: allProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, full_name")
      .eq("company_id", profile.company_id);
    const profilesList = allProfiles || [];

    function resolveAssigneeUserId(assignedName: string | null): string | null {
      if (!assignedName) return null;
      const nameLower = assignedName.toLowerCase().trim();
      const exact = profilesList.find(p => p.full_name?.toLowerCase().trim() === nameLower);
      if (exact?.user_id) return exact.user_id;
      const fuzzy = profilesList.find(p =>
        p.full_name?.toLowerCase().includes(nameLower) || nameLower.includes(p.full_name?.toLowerCase() || "___")
      );
      return fuzzy?.user_id || null;
    }

    // ── Fetch recent emails ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: emails, error: queryError } = await supabaseAdmin
      .from("communications")
      .select("id, source_id, from_address, to_address, subject, body_preview, metadata, received_at, thread_id")
      .or("to_address.ilike.%@rebar.shop%,from_address.ilike.%@rebar.shop%")
      .gte("received_at", thirtyDaysAgo.toISOString())
      .order("received_at", { ascending: false })
      .limit(200);

    if (queryError) throw queryError;

    if (!emails?.length) {
      return new Response(
        JSON.stringify({ created: 0, skipped: 0, filtered: 0, prefiltered: 0, escalated: 0, total: 0, leads: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const candidateEmails = emails.filter((e) => !shouldSkipSender(e.from_address || "", e.to_address || ""));
    const prefiltered = emails.length - candidateEmails.length;

    if (candidateEmails.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, skipped: 0, filtered: 0, prefiltered, escalated: 0, total: emails.length, leads: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check already-processed emails (leads + activities + pending_review human_tasks)
    const emailIds = candidateEmails.map((e) => `comm_${e.id}`);
    const { data: existingLeads } = await supabaseAdmin
      .from("leads")
      .select("source_email_id")
      .in("source_email_id", emailIds);

    const processedIds = new Set((existingLeads ?? []).map((l) => l.source_email_id));

    const { data: existingActivities } = await supabaseAdmin
      .from("lead_activities")
      .select("metadata")
      .eq("company_id", profile.company_id)
      .eq("activity_type", "email")
      .not("metadata", "is", null)
      .limit(1000);
    const routedEmailIds = new Set<string>();
    for (const act of existingActivities || []) {
      const m = act.metadata as Record<string, unknown> | null;
      if (m?.source_email_id) routedEmailIds.add(m.source_email_id as string);
    }

    // Check human_tasks for pending_review emails (escalated but not yet resolved)
    const { data: pendingTasks } = await supabaseAdmin
      .from("human_tasks")
      .select("dedupe_key")
      .eq("category", "email_routing")
      .in("status", ["open", "snoozed"])
      .not("dedupe_key", "is", null);
    const pendingReviewKeys = new Set((pendingTasks || []).map(t => t.dedupe_key));

    // ── Process emails ──
    const results: Array<{
      emailId: string;
      from: string;
      subject: string;
      action: "created" | "skipped" | "filtered" | "routed" | "escalated";
      lead?: LeadExtraction;
      customerAction?: "matched" | "created";
      customerName?: string;
      routedToLead?: string;
      matchScore?: number;
    }> = [];

    let created = 0;
    let skipped = 0;
    let filtered = 0;
    let routed = 0;
    let escalated = 0;

    let nextNumber = await getNextLeadNumber(supabaseAdmin);
    let currentNum = parseInt(nextNumber.replace("S", ""), 10);

    for (const email of candidateEmails) {
      const sourceEmailId = `comm_${email.id}`;

      // ── Dedup: already processed? ──
      if (processedIds.has(sourceEmailId) || routedEmailIds.has(sourceEmailId)) {
        skipped++;
        results.push({ emailId: email.id, from: email.from_address || "", subject: email.subject || "", action: "skipped" });
        continue;
      }

      // Dedup: pending escalation review?
      if (pendingReviewKeys.has(`email_routing_${sourceEmailId}`)) {
        skipped++;
        results.push({ emailId: email.id, from: email.from_address || "", subject: email.subject || "", action: "skipped" });
        continue;
      }

      const from = email.from_address || "";
      const subject = email.subject || "";
      const meta = email.metadata as Record<string, unknown> | null;
      const body = (meta?.body as string) || email.body_preview || "";
      const emailThreadId = email.thread_id || null;

      // Extract headers for In-Reply-To / References
      const headers = (meta?.headers as Record<string, string>) || {};
      const inReplyTo = headers["In-Reply-To"] || headers["in-reply-to"] || null;
      const referencesHeader = headers["References"] || headers["references"] || "";
      const referencesList = referencesHeader ? referencesHeader.split(/\s+/).filter(Boolean) : [];

      // Extract sender email
      const senderEmailMatch = from.match(/<([^>]+)>/) || [null, from];
      const senderEmail = (senderEmailMatch[1] || from).trim();

      // Extract attachment filenames
      const emailAttachments = (meta?.attachments as Array<{ filename: string; mimeType: string; attachmentId: string; size?: number }>) || [];
      const attachmentFilenames = emailAttachments.map(a => a.filename);

      // ── Thread-level dedup: if this thread is already linked to a lead ──
      if (emailThreadId && threadToLeadId.has(emailThreadId)) {
        const existingLeadId = threadToLeadId.get(emailThreadId)!;
        const existingLead = activeLeads.find(l => l.id === existingLeadId);
        if (existingLead) {
          try {
            console.log(`Thread dedup: routing "${subject}" to lead: ${existingLead.title}`);

            // Download attachments
            const attachmentNames: string[] = [];
            for (const att of emailAttachments.slice(0, 5)) {
              if (email.source_id) {
                const stored = await downloadAndStoreAttachment(supabaseAdmin, user.id, email.source_id, att, existingLead.id);
                if (stored) attachmentNames.push(stored.filename);
              }
            }

            await supabaseAdmin.from("lead_activities").insert({
              lead_id: existingLead.id,
              company_id: profile.company_id,
              activity_type: "email",
              title: "Follow-up email received (thread match)",
              description: [
                `📧 From: ${from}`,
                `Subject: ${subject}`,
                body ? `Preview: ${body.substring(0, 300)}...` : "",
                attachmentNames.length > 0 ? `📎 ${attachmentNames.length} attachment(s): ${attachmentNames.join(", ")}` : "",
              ].filter(Boolean).join("\n"),
              created_by: "Blitz AI",
              metadata: { source_email_id: sourceEmailId, routing: "thread_dedup", confidence: 0.95 },
            });

            const assignMatch = existingLead.notes?.match(/Assigned:\s*([^|\n]+)/);
            const assigneeUserId = resolveAssigneeUserId(assignMatch?.[1]?.trim() || null);
            if (assigneeUserId) {
              await supabaseAdmin.from("notifications").insert({
                user_id: assigneeUserId,
                type: "notification",
                title: `New email on lead: ${existingLead.title}`,
                description: `Email from ${senderEmail} — Subject: ${subject}`,
                priority: "normal",
                link_to: "/pipeline",
                agent_name: "Blitz",
                agent_color: "bg-sky-500",
                status: "unread",
              });
            }

            routed++;
            routedEmailIds.add(sourceEmailId);
            results.push({ emailId: email.id, from, subject, action: "routed", routedToLead: existingLead.title, matchScore: 0.95 });
            continue;
          } catch (err) {
            console.error("Thread dedup routing failed:", err);
          }
        }
      }

      // ── Multi-Signal Scoring ──
      const candidates = scoreEmailAgainstLeads(
        { threadId: emailThreadId, inReplyTo, references: referencesList, senderEmail, subject, body, attachmentFilenames },
        activeLeads.map(l => ({ id: l.id, title: l.title, customer_id: l.customer_id, notes: l.notes, metadata: l.metadata as Record<string, unknown> | null })),
        commsForLeads,
        emailToCustomerId,
      );

      const bestMatch = candidates[0] || null;

      // ── Decision: Auto-route (>= 0.8) ──
      if (bestMatch && bestMatch.score >= THRESHOLD_AUTO_ROUTE) {
        try {
          console.log(`Auto-routing "${subject}" to lead: ${bestMatch.leadTitle} (score: ${bestMatch.score.toFixed(2)}, signals: ${bestMatch.matchedSignals.join(",")})`);

          const attachmentNames: string[] = [];
          for (const att of emailAttachments.slice(0, 5)) {
            if (email.source_id) {
              const stored = await downloadAndStoreAttachment(supabaseAdmin, user.id, email.source_id, att, bestMatch.leadId);
              if (stored) attachmentNames.push(stored.filename);
            }
          }

          await supabaseAdmin.from("lead_activities").insert({
            lead_id: bestMatch.leadId,
            company_id: profile.company_id,
            activity_type: "email",
            title: "Follow-up email received",
            description: [
              `📧 From: ${from}`,
              `Subject: ${subject}`,
              body ? `Preview: ${body.substring(0, 300)}...` : "",
              attachmentNames.length > 0 ? `📎 ${attachmentNames.length} attachment(s): ${attachmentNames.join(", ")}` : "",
              `🔗 Auto-routed (confidence: ${(bestMatch.score * 100).toFixed(0)}% — ${bestMatch.matchedSignals.join(", ")})`,
            ].filter(Boolean).join("\n"),
            created_by: "Blitz AI",
            metadata: { source_email_id: sourceEmailId, routing: "auto", confidence: bestMatch.score, signals: bestMatch.matchedSignals },
          });

          const assigneeUserId = resolveAssigneeUserId(bestMatch.assignedTo);
          if (assigneeUserId) {
            await supabaseAdmin.from("notifications").insert({
              user_id: assigneeUserId,
              type: "notification",
              title: `New email on lead: ${bestMatch.leadTitle}`,
              description: `Email from ${senderEmail} — Subject: ${subject}`,
              priority: "normal",
              link_to: "/pipeline",
              agent_name: "Blitz",
              agent_color: "bg-sky-500",
              status: "unread",
            });
          }

          routed++;
          routedEmailIds.add(sourceEmailId);
          results.push({ emailId: email.id, from, subject, action: "routed", routedToLead: bestMatch.leadTitle, matchScore: bestMatch.score });
          continue;
        } catch (routeErr) {
          console.error(`Failed to auto-route email to lead ${bestMatch.leadId}:`, routeErr);
        }
      }

      // ── Decision: Escalate (0.4 - 0.79) ──
      if (bestMatch && bestMatch.score >= THRESHOLD_ESCALATE) {
        try {
          console.log(`Escalating "${subject}" — uncertain match to ${bestMatch.leadTitle} (score: ${bestMatch.score.toFixed(2)})`);

          await escalateUncertainMatch(
            supabaseAdmin,
            profile.company_id,
            { id: email.id, from, subject, snippet: body.substring(0, 500), sourceEmailId },
            candidates,
          );

          escalated++;
          routedEmailIds.add(sourceEmailId); // prevent re-processing
          results.push({ emailId: email.id, from, subject, action: "escalated", matchScore: bestMatch.score });
          continue;
        } catch (escErr) {
          console.error("Escalation failed:", escErr);
          // Fall through to normal processing
        }
      }

      // ── Decision: No match (< 0.4) → check reply guard, then AI classification ──

      // Reply guard: Re:/FW: with no match → escalate, don't create new lead
      const isReplyOrForward = /^(Re|RE|Fwd|FW|FWD)\s*:/i.test(subject.trim());
      if (isReplyOrForward && (!bestMatch || bestMatch.score < THRESHOLD_ESCALATE)) {
        console.log(`Reply guard: "${subject}" is a reply/forward with no match (score: ${bestMatch?.score?.toFixed(2) ?? 'none'}) — escalating instead of creating new lead`);
        try {
          await escalateUncertainMatch(
            supabaseAdmin,
            profile.company_id,
            { id: email.id, from, subject, snippet: body.substring(0, 500), sourceEmailId },
            candidates,
          );
          escalated++;
          routedEmailIds.add(sourceEmailId);
          results.push({ emailId: email.id, from, subject, action: "escalated_reply_guard", matchScore: bestMatch?.score ?? 0 });
          continue;
        } catch (rgErr) {
          console.error("Reply guard escalation failed:", rgErr);
          // Fall through to normal processing
        }
      }

      try {
        // === KEYWORD FAST-TRACK ===
        const LEAD_KEYWORDS = /\b(quote|quotation|pricing|price|bid|tender|rfq|estimation|estimate|proposal|budget|cost|shop drawing|rebar.*order)\b/i;
        const LEAD_PHRASES = /(request for (a )?(quote|quotation|pricing|price|estimate|proposal|bid))/i;
        const textToCheck = `${subject} ${body.substring(0, 1000)}`;
        const hasLeadKeyword = LEAD_KEYWORDS.test(textToCheck) || LEAD_PHRASES.test(textToCheck);

        const analysis = await analyzeEmailWithAI(subject, from, body);

        if (!analysis.is_lead && hasLeadKeyword) {
          console.log(`Keyword fast-track override for: "${subject}"`);
          analysis.is_lead = true;
          analysis.reason = `Keyword match in subject/body (${subject}). AI originally filtered but overridden.`;
          analysis.title = subject;
        }

        if (!analysis.is_lead) {
          filtered++;
          results.push({ emailId: email.id, from, subject, action: "filtered", lead: analysis });
          continue;
        }

        // ── Customer + time window dedup before creating ──
        const senderDomain = senderEmail.split("@")[1] || "";
        const senderCompanyGuess = senderDomain.split(".")[0] || "";
        const senderCustId = emailToCustomerId.get(senderEmail.toLowerCase().trim());

        if (senderCustId) {
          const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          const recentLeadsForCustomer = activeLeads.filter(
            l => l.customer_id === senderCustId && l.updated_at >= twoDaysAgo
          );
          const emailTokens = tokenize(stripPrefixes(subject));
          for (const rl of recentLeadsForCustomer) {
            const leadTokens = tokenize(rl.title);
            if (jaccardSimilarity(emailTokens, leadTokens) > 0.5) {
              console.log(`Customer+time dedup: routing "${subject}" to recent lead: ${rl.title}`);

              await supabaseAdmin.from("lead_activities").insert({
                lead_id: rl.id,
                company_id: profile.company_id,
                activity_type: "email",
                title: "Follow-up email received (customer dedup)",
                description: [
                  `📧 From: ${from}`,
                  `Subject: ${subject}`,
                  body ? `Preview: ${body.substring(0, 300)}...` : "",
                ].filter(Boolean).join("\n"),
                created_by: "Blitz AI",
                metadata: { source_email_id: sourceEmailId, routing: "customer_time_dedup" },
              });

              routed++;
              routedEmailIds.add(sourceEmailId);
              results.push({ emailId: email.id, from, subject, action: "routed", routedToLead: rl.title });
              break;
            }
          }
          // If we routed via dedup, skip to next email
          if (routedEmailIds.has(sourceEmailId)) continue;
        }

        // ── Reference number dedup ──
        const emailRefs = extractReferences(subject, body);
        if (emailRefs.length > 0) {
          for (const lead of activeLeads) {
            const leadMeta = (lead.metadata as Record<string, unknown>) || {};
            const leadRefs = (leadMeta.external_refs as string[]) || [];
            const leadTitle = lead.title.toUpperCase();
            for (const ref of emailRefs) {
              if (leadTitle.includes(ref) || leadRefs.map(r => r.toUpperCase()).includes(ref)) {
                console.log(`Reference dedup: routing "${subject}" to lead: ${lead.title} (ref: ${ref})`);

                await supabaseAdmin.from("lead_activities").insert({
                  lead_id: lead.id,
                  company_id: profile.company_id,
                  activity_type: "email",
                  title: "Follow-up email received (reference match)",
                  description: [
                    `📧 From: ${from}`,
                    `Subject: ${subject}`,
                    `🔗 Matched reference: ${ref}`,
                    body ? `Preview: ${body.substring(0, 300)}...` : "",
                  ].filter(Boolean).join("\n"),
                  created_by: "Blitz AI",
                  metadata: { source_email_id: sourceEmailId, routing: "reference_dedup", matched_ref: ref },
                });

                routed++;
                routedEmailIds.add(sourceEmailId);
                results.push({ emailId: email.id, from, subject, action: "routed", routedToLead: lead.title });
                break;
              }
            }
            if (routedEmailIds.has(sourceEmailId)) break;
          }
          if (routedEmailIds.has(sourceEmailId)) continue;
        }

        // === CUSTOMER MATCHING ===
        let customerId: string | null = null;
        let customerAction: "matched" | "created" = "matched";
        let matchedCustomerName = analysis.sender_company;

        const matchedCustomer = findMatchingCustomer(analysis.sender_company, customers);

        if (matchedCustomer) {
          customerId = matchedCustomer.id;
          matchedCustomerName = matchedCustomer.company_name || matchedCustomer.name;
          customerAction = "matched";
        } else if (analysis.sender_company && analysis.sender_company.trim() !== "") {
          const { data: newCustomer, error: custError } = await supabaseAdmin
            .from("customers")
            .insert({
              name: analysis.sender_company,
              company_name: analysis.sender_company,
              company_id: profile.company_id,
              status: "active",
              notes: `Auto-created from RFQ email scan.\nContact: ${analysis.sender_name}\nEmail: ${analysis.sender_email}\nPhone: ${analysis.sender_phone || "N/A"}`,
            })
            .select("id, name, company_name")
            .single();

          if (!custError && newCustomer) {
            customerId = newCustomer.id;
            customerAction = "created";
            customers.push(newCustomer);
          } else {
            console.error("Failed to create customer:", custError);
          }
        }

        // === CREATE CONTACT ===
        if (customerId && analysis.sender_name && analysis.sender_email) {
          const { data: existingContact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("customer_id", customerId)
            .ilike("email", analysis.sender_email)
            .limit(1);

          if (!existingContact?.length) {
            const nameParts = analysis.sender_name.split(" ");
            await supabaseAdmin.from("contacts").insert({
              customer_id: customerId,
              company_id: profile.company_id,
              first_name: nameParts[0] || analysis.sender_name,
              last_name: nameParts.slice(1).join(" ") || null,
              email: analysis.sender_email,
              phone: analysis.sender_phone || null,
              is_primary: true,
            });
          }
        }

        // === INTELLIGENT NAMING ===
        const leadNumber = `S${String(currentNum).padStart(5, "0")}`;
        currentNum++;
        const displayCompany = matchedCustomerName || analysis.sender_company || analysis.sender_name;
        const projectTitle = analysis.title || "RFQ";
        const leadTitle = `${leadNumber}, ${displayCompany}: ${projectTitle}`;

        // === AUTO-ASSIGNMENT ===
        const historicalAssignee = customerId ? customerAssignments.get(customerId) : null;
        const assignedTo = historicalAssignee || DEFAULT_RFQ_ASSIGNEE;
        const toAddress = email.to_address || "";

        const noteParts: string[] = [];
        noteParts.push(`Assigned: ${assignedTo}`);
        if (analysis.city) noteParts.push(`City: ${analysis.city}`);
        noteParts.push(`From: ${from}`);
        noteParts.push(`To: ${toAddress}`);
        noteParts.push(`Subject: ${subject}`);
        if (analysis.sender_phone) noteParts.push(`Phone: ${analysis.sender_phone}`);
        noteParts.push(`Received: ${email.received_at}`);
        noteParts.push(`AI Reason: ${analysis.reason}`);

        // === INSERT LEAD ===
        const { data: newLead, error: insertError } = await supabaseAdmin
          .from("leads")
          .insert({
            title: leadTitle,
            description: analysis.description,
            stage: "new",
            source: `Email: ${analysis.sender_email || from}`,
            source_email_id: sourceEmailId,
            priority: analysis.priority,
            expected_value: analysis.expected_value,
            customer_id: customerId,
            company_id: profile.company_id,
            notes: noteParts.join(" | "),
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Failed to insert lead:", insertError);
          if (insertError.code === "23505") {
            skipped++;
            results.push({ emailId: email.id, from, subject, action: "skipped" });
          }
          continue;
        }

        // === STORE ROUTING METADATA ===
        if (newLead?.id) {
          const emailBody = (meta?.body as string) || email.body_preview || "";
          const fileLinks = extractFileLinks(emailBody);
          const leadFiles: Array<{ type: "attachment" | "link"; filename: string; url?: string; path?: string; mimeType?: string; size?: number }> = [];

          if (emailAttachments.length > 0 && email.source_id) {
            for (const att of emailAttachments.slice(0, 5)) {
              const stored = await downloadAndStoreAttachment(supabaseAdmin, user.id, email.source_id, att, newLead.id);
              if (stored) {
                leadFiles.push({ type: "attachment", filename: stored.filename, path: stored.path, mimeType: stored.mimeType, size: stored.size });
              }
            }
          }

          for (const link of fileLinks) {
            const urlFilename = link.split("/").pop()?.split("?")[0] || "download";
            leadFiles.push({ type: "link", filename: urlFilename, url: link });
          }

          const leadMetadata: Record<string, unknown> = {
            email_subject: subject,
            email_body: emailBody.substring(0, 5000),
            email_from: from,
            email_to: email.to_address || "",
            email_date: email.received_at,
            // New routing metadata
            thread_id: emailThreadId,
            external_refs: emailRefs,
            rfq_ref: emailRefs[0] || null,
            email_message_ids: [email.source_id].filter(Boolean),
            routing_confidence: bestMatch?.score || 0,
          };

          if (leadFiles.length > 0) {
            leadMetadata.files = leadFiles;
            leadMetadata.attachment_count = leadFiles.filter(f => f.type === "attachment").length;
            leadMetadata.link_count = leadFiles.filter(f => f.type === "link").length;
          }

          await supabaseAdmin
            .from("leads")
            .update({ metadata: leadMetadata })
            .eq("id", newLead.id);
        }

        // === LOG TIMELINE ACTIVITY ===
        if (newLead?.id) {
          const emailBody = (meta?.body as string) || email.body_preview || "";
          const fileLinks = extractFileLinks(emailBody);

          await supabaseAdmin.from("lead_activities").insert({
            lead_id: newLead.id,
            company_id: profile.company_id,
            activity_type: "email",
            title: "RFQ received via email",
            description: [
              `New inquiry from ${analysis.sender_name} at ${displayCompany}.`,
              analysis.description,
              analysis.city ? `📍 Location: ${analysis.city}` : "",
              customerAction === "created" ? `🆕 New customer created automatically.` : `✅ Matched to existing customer.`,
              assignedTo ? `👤 ${historicalAssignee ? 'Auto-assigned' : 'Default assigned'} to ${assignedTo}${historicalAssignee ? ' (handles this customer)' : ''}.` : "",
              emailAttachments.length > 0 ? `📎 ${emailAttachments.length} attachment(s): ${emailAttachments.map(a => a.filename).join(", ")}` : "",
              fileLinks.length > 0 ? `🔗 ${fileLinks.length} download link(s) found` : "",
            ].filter(Boolean).join("\n"),
            created_by: "Blitz AI",
          });
        }

        created++;
        results.push({
          emailId: email.id, from, subject,
          action: "created",
          lead: analysis,
          customerAction,
          customerName: matchedCustomerName,
        });
      } catch (aiError) {
        console.error(`AI analysis failed for email ${email.id}:`, aiError);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ created, skipped, filtered, routed, escalated, prefiltered, total: emails.length, leads: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-rfq-emails error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
