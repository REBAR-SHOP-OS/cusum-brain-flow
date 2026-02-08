import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// System/marketing senders to skip before AI analysis (saves API calls)
const SKIP_SENDERS = [
  "noreply@", "no-reply@", "mailer-daemon@", "postmaster@",
  "@accounts.google.com", "@uber.com", "@stripe.com", "@siteground.com",
  "@myactivecampaign.com", "@go.autodesk.com", "@tm.openai.com",
  "@sgsitescanner.", "@linkedin.com", "@facebookmail.com",
  "@github.com", "@notify.", "@newsletter.", "@marketing.",
];

// Skip emails FROM @rebar.shop (internal)
const INTERNAL_DOMAIN = "@rebar.shop";

interface LeadExtraction {
  is_lead: boolean;
  title: string;
  description: string;
  sender_name: string;
  sender_company: string;
  expected_value: number | null;
  priority: "low" | "medium" | "high";
  reason: string;
}

async function analyzeEmailWithAI(
  subject: string,
  from: string,
  body: string
): Promise<LeadExtraction> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const prompt = `You are an AI assistant for a rebar fabrication company (rebar.shop). Analyze this email and determine if it's a legitimate business lead — someone requesting a quote, pricing, or inquiring about rebar/steel fabrication services.

EMAIL:
From: ${from}
Subject: ${subject}
Body:
${(body || "").substring(0, 3000)}

Analyze and respond using the suggest_lead tool. An email IS a lead if it:
- Requests a quote or pricing for rebar/steel/fabrication work
- Inquires about services, projects, or capabilities  
- Is from a construction company, contractor, engineer, or supplier asking about rebar
- Contains project details, drawings, or specifications
- Asks about availability, pricing, or timelines for rebar work

An email is NOT a lead if it:
- Is spam, marketing, newsletters, or automated notifications
- Is a receipt, invoice, or billing notification
- Is a security alert, password reset, or system notification
- Is promotional content from software vendors
- Is internal communication between @rebar.shop employees
- Is a job application or recruitment email`;

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
                is_lead: {
                  type: "boolean",
                  description: "Whether this email is a legitimate business lead/RFQ",
                },
                title: {
                  type: "string",
                  description: "A concise title for the lead (e.g., 'RFQ - 500 tons rebar for Highway Project')",
                },
                description: {
                  type: "string",
                  description: "Brief summary of what the customer is requesting",
                },
                sender_name: {
                  type: "string",
                  description: "Name of the person who sent the email",
                },
                sender_company: {
                  type: "string",
                  description: "Company name of the sender, if identifiable",
                },
                expected_value: {
                  type: "number",
                  description: "Estimated deal value in dollars if mentioned, null otherwise",
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  description: "Priority based on urgency and deal size",
                },
                reason: {
                  type: "string",
                  description: "Brief reason for the classification decision",
                },
              },
              required: ["is_lead", "title", "description", "sender_name", "sender_company", "priority", "reason"],
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

  if (!toolCall?.function?.arguments) {
    throw new Error("AI did not return structured output");
  }

  return JSON.parse(toolCall.function.arguments) as LeadExtraction;
}

function shouldSkipSender(from: string): boolean {
  const lowerFrom = from.toLowerCase();
  // Skip internal emails
  if (lowerFrom.includes(INTERNAL_DOMAIN)) return true;
  // Skip known system/marketing senders
  return SKIP_SENDERS.some((pattern) => lowerFrom.includes(pattern));
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

    // Validate user
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

    // Get user's company_id
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

    // Step 1: Fetch recent emails from communications table 
    // that were sent TO any @rebar.shop address (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log("Scanning communications for leads...");

    const { data: emails, error: queryError } = await supabaseAdmin
      .from("communications")
      .select("id, source_id, from_address, to_address, subject, body_preview, metadata, received_at")
      .ilike("to_address", "%@rebar.shop%")
      .gte("received_at", thirtyDaysAgo.toISOString())
      .order("received_at", { ascending: false })
      .limit(100);

    if (queryError) throw queryError;

    console.log(`Found ${emails?.length || 0} emails to @rebar.shop`);

    if (!emails?.length) {
      return new Response(
        JSON.stringify({ created: 0, skipped: 0, filtered: 0, prefiltered: 0, total: 0, leads: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Pre-filter obvious non-leads (system emails, internal, etc.)
    const candidateEmails = emails.filter((e) => !shouldSkipSender(e.from_address || ""));
    const prefiltered = emails.length - candidateEmails.length;
    console.log(`Pre-filtered ${prefiltered} system/internal emails, ${candidateEmails.length} candidates remain`);

    if (candidateEmails.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, skipped: 0, filtered: 0, prefiltered, total: emails.length, leads: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Check which emails have already been processed
    const emailIds = candidateEmails.map((e) => `comm_${e.id}`);
    const { data: existingLeads } = await supabaseAdmin
      .from("leads")
      .select("source_email_id")
      .in("source_email_id", emailIds);

    const processedIds = new Set((existingLeads ?? []).map((l) => l.source_email_id));

    // Step 4: Process unprocessed emails with AI
    const results: Array<{
      emailId: string;
      from: string;
      subject: string;
      action: "created" | "skipped" | "filtered";
      lead?: LeadExtraction;
    }> = [];

    let created = 0;
    let skipped = 0;
    let filtered = 0;

    for (const email of candidateEmails) {
      const sourceEmailId = `comm_${email.id}`;

      if (processedIds.has(sourceEmailId)) {
        skipped++;
        results.push({
          emailId: email.id,
          from: email.from_address || "",
          subject: email.subject || "",
          action: "skipped",
        });
        continue;
      }

      const from = email.from_address || "";
      const subject = email.subject || "";
      // Use full body from metadata if available, fallback to preview
      const meta = email.metadata as Record<string, unknown> | null;
      const body = (meta?.body as string) || email.body_preview || "";

      try {
        const analysis = await analyzeEmailWithAI(subject, from, body);

        if (!analysis.is_lead) {
          filtered++;
          results.push({ emailId: email.id, from, subject, action: "filtered", lead: analysis });
          continue;
        }

        // Extract sender email from "Name <email>" format
        const senderEmail = from.match(/<(.+?)>/)?.[1] || from;
        // Extract which @rebar.shop address received it
        const toAddress = email.to_address || "";

        const { error: insertError } = await supabaseAdmin.from("leads").insert({
          title: analysis.title,
          description: analysis.description,
          stage: "new",
          source: `Email: ${senderEmail}`,
          source_email_id: sourceEmailId,
          priority: analysis.priority,
          expected_value: analysis.expected_value,
          company_id: profile.company_id,
          notes: [
            `Auto-created from email scan.`,
            `From: ${from}`,
            `To: ${toAddress}`,
            `Subject: ${subject}`,
            `Company: ${analysis.sender_company}`,
            `Received: ${email.received_at}`,
            `AI Reason: ${analysis.reason}`,
          ].join("\n"),
        });

        if (insertError) {
          console.error("Failed to insert lead:", insertError);
          if (insertError.code === "23505") {
            skipped++;
            results.push({ emailId: email.id, from, subject, action: "skipped" });
          }
          continue;
        }

        created++;
        results.push({ emailId: email.id, from, subject, action: "created", lead: analysis });
      } catch (aiError) {
        console.error(`AI analysis failed for email ${email.id}:`, aiError);
        continue;
      }
    }

    console.log(`Done: ${created} created, ${skipped} already processed, ${filtered} AI-filtered, ${prefiltered} pre-filtered`);

    return new Response(
      JSON.stringify({
        created,
        skipped,
        filtered,
        prefiltered,
        total: emails.length,
        leads: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-rfq-emails error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
