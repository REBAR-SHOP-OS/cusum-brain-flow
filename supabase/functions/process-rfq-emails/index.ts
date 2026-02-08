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
  "@synologynotification.com",
];

// Internal bot senders to skip (but real team members should pass through)
const SKIP_INTERNAL_BOTS = ["odoobot"];

const INTERNAL_DOMAIN = "@rebar.shop";


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

An email IS a lead if it:
- Requests a quote or pricing for rebar/steel/fabrication work
- Inquires about services, projects, or capabilities  
- Is from a construction company, contractor, engineer, or supplier asking about rebar
- Contains project details, drawings, or specifications
- Asks about availability, pricing, or timelines for rebar work

An email is NOT a lead if it's spam, marketing, newsletters, receipts, system notifications, job applications, or internal @rebar.shop communication.

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
  const lowerTo = to.toLowerCase();

  // Skip known system/marketing senders
  if (SKIP_SENDERS.some((pattern) => lowerFrom.includes(pattern))) return true;

  // Skip internal bot messages (OdooBot), but NOT real team members
  if (lowerFrom.includes(INTERNAL_DOMAIN)) {
    // Extract sender name before the email — e.g. "OdooBot <rfq@rebar.shop>"
    const nameMatch = from.match(/^([^<]+)</);
    const senderName = (nameMatch?.[1] || "").trim().toLowerCase();
    if (SKIP_INTERNAL_BOTS.some((bot) => senderName.includes(bot))) return true;

    // If both from AND to are @rebar.shop and it's purely internal routing, let AI decide
    // (team members forward customer RFQs internally — these are valid)
  }

  // Skip if BOTH from and to are internal AND there's no external party involved
  // (pure internal chatter with no customer context)
  if (lowerFrom.includes(INTERNAL_DOMAIN) && lowerTo.includes(INTERNAL_DOMAIN)) {
    // Check if to_address has any external recipients
    const toAddresses = lowerTo.split(",").map(a => a.trim());
    const hasExternal = toAddresses.some(a => !a.includes(INTERNAL_DOMAIN));
    if (!hasExternal) {
      // Pure internal — still let it through, AI will decide if it's a forwarded RFQ
      // Only skip if subject is clearly internal task assignment
      if (lowerFrom.includes("odoobot") || /assigned to you|task update/i.test(from + " " + (to || ""))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Fuzzy-match a company name against existing customers.
 * Returns the best match if similarity is high enough.
 */
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

    // Exact match after normalization
    if (candidateName === target) return customer;

    // Check if one contains the other
    if (candidateName.includes(target) || target.includes(candidateName)) {
      const score = Math.min(candidateName.length, target.length) / Math.max(candidateName.length, target.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = customer;
      }
    }

    // Token overlap scoring
    const targetTokens = new Set(target.split(" ").filter(t => t.length > 2));
    const candidateTokens = new Set(candidateName.split(" ").filter(t => t.length > 2));
    if (targetTokens.size > 0 && candidateTokens.size > 0) {
      let overlap = 0;
      for (const t of targetTokens) {
        if (candidateTokens.has(t)) overlap++;
      }
      const score = (2 * overlap) / (targetTokens.size + candidateTokens.size);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = customer;
      }
    }
  }

  // Require at least 50% similarity
  return bestScore >= 0.5 ? bestMatch : null;
}

/**
 * Get next sequential lead number (SXXXXX format)
 */
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

    // Fetch all customers for matching
    const { data: allCustomers } = await supabaseAdmin
      .from("customers")
      .select("id, name, company_name")
      .eq("company_id", profile.company_id);
    const customers = allCustomers || [];

    // Look up who is assigned to existing leads by customer (for auto-assignment)
    const { data: assignmentHistory } = await supabaseAdmin
      .from("leads")
      .select("customer_id, notes")
      .eq("company_id", profile.company_id)
      .not("customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(500);

    // Build a map: customer_id → most recent assigned person
    const customerAssignments = new Map<string, string>();
    for (const lead of assignmentHistory || []) {
      if (lead.customer_id && lead.notes && !customerAssignments.has(lead.customer_id)) {
        const match = lead.notes.match(/Assigned:\s*([^|\n]+)/);
        if (match) customerAssignments.set(lead.customer_id, match[1].trim());
      }
    }

    // Fetch recent emails involving @rebar.shop (last 30 days)
    // Include both inbound (TO @rebar.shop) and outbound (FROM @rebar.shop) 
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log("Scanning communications for leads...");

    const { data: emails, error: queryError } = await supabaseAdmin
      .from("communications")
      .select("id, source_id, from_address, to_address, subject, body_preview, metadata, received_at")
      .or("to_address.ilike.%@rebar.shop%,from_address.ilike.%@rebar.shop%")
      .gte("received_at", thirtyDaysAgo.toISOString())
      .order("received_at", { ascending: false })
      .limit(200);

    if (queryError) throw queryError;
    console.log(`Found ${emails?.length || 0} emails involving @rebar.shop`);

    if (!emails?.length) {
      return new Response(
        JSON.stringify({ created: 0, skipped: 0, filtered: 0, prefiltered: 0, total: 0, leads: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pre-filter system/bot emails
    const candidateEmails = emails.filter((e) => !shouldSkipSender(e.from_address || "", e.to_address || ""));
    const prefiltered = emails.length - candidateEmails.length;
    console.log(`Pre-filtered ${prefiltered} system/bot emails, ${candidateEmails.length} candidates remain`);

    if (candidateEmails.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, skipped: 0, filtered: 0, prefiltered, total: emails.length, leads: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check already-processed emails
    const emailIds = candidateEmails.map((e) => `comm_${e.id}`);
    const { data: existingLeads } = await supabaseAdmin
      .from("leads")
      .select("source_email_id")
      .in("source_email_id", emailIds);

    const processedIds = new Set((existingLeads ?? []).map((l) => l.source_email_id));

    // Process unprocessed emails
    const results: Array<{
      emailId: string;
      from: string;
      subject: string;
      action: "created" | "skipped" | "filtered";
      lead?: LeadExtraction;
      customerAction?: "matched" | "created";
      customerName?: string;
    }> = [];

    let created = 0;
    let skipped = 0;
    let filtered = 0;

    // Get the starting lead number once
    let nextNumber = await getNextLeadNumber(supabaseAdmin);
    let currentNum = parseInt(nextNumber.replace("S", ""), 10);

    for (const email of candidateEmails) {
      const sourceEmailId = `comm_${email.id}`;

      if (processedIds.has(sourceEmailId)) {
        skipped++;
        results.push({ emailId: email.id, from: email.from_address || "", subject: email.subject || "", action: "skipped" });
        continue;
      }

      const from = email.from_address || "";
      const subject = email.subject || "";
      const meta = email.metadata as Record<string, unknown> | null;
      const body = (meta?.body as string) || email.body_preview || "";

      try {
        const analysis = await analyzeEmailWithAI(subject, from, body);

        if (!analysis.is_lead) {
          filtered++;
          results.push({ emailId: email.id, from, subject, action: "filtered", lead: analysis });
          continue;
        }

        // === CUSTOMER MATCHING ===
        let customerId: string | null = null;
        let customerAction: "matched" | "created" = "matched";
        let matchedCustomerName = analysis.sender_company;

        // Try to match existing customer
        const matchedCustomer = findMatchingCustomer(analysis.sender_company, customers);

        if (matchedCustomer) {
          customerId = matchedCustomer.id;
          matchedCustomerName = matchedCustomer.company_name || matchedCustomer.name;
          customerAction = "matched";
          console.log(`Matched customer: "${analysis.sender_company}" → "${matchedCustomerName}" (${customerId})`);
        } else if (analysis.sender_company && analysis.sender_company.trim() !== "") {
          // Create new customer
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
            // Add to local list for future matching in this batch
            customers.push(newCustomer);
            console.log(`Created new customer: "${analysis.sender_company}" (${customerId})`);
          } else {
            console.error("Failed to create customer:", custError);
          }
        }

        // === CREATE CONTACT if we have a customer and contact info ===
        if (customerId && analysis.sender_name && analysis.sender_email) {
          // Check if contact already exists
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
        // Check if this customer has a historical assigned person
        const assignedTo = customerId ? customerAssignments.get(customerId) : null;
        const toAddress = email.to_address || "";

        // Build structured notes
        const noteParts: string[] = [];
        if (assignedTo) noteParts.push(`Assigned: ${assignedTo}`);
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

        // === LOG TIMELINE ACTIVITY ===
        if (newLead?.id) {
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
              assignedTo ? `👤 Auto-assigned to ${assignedTo} (handles this customer).` : "",
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

    console.log(`Done: ${created} created, ${skipped} already processed, ${filtered} AI-filtered, ${prefiltered} pre-filtered`);

    return new Response(
      JSON.stringify({ created, skipped, filtered, prefiltered, total: emails.length, leads: results }),
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
