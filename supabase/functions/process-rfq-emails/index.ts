import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RFQ_EMAIL = "rfq@rebar.shop";

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate: string;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function getBodyContent(message: GmailMessage): string {
  if (message.payload.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }
  const textPart = message.payload.parts?.find((p) => p.mimeType === "text/plain");
  if (textPart?.body?.data) {
    return decodeBase64Url(textPart.body.data);
  }
  return message.snippet;
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth credentials not configured for RFQ inbox");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchRecentEmails(accessToken: string, maxResults = 20): Promise<GmailMessage[]> {
  // Search for emails sent TO rfq@rebar.shop
  const query = `to:${RFQ_EMAIL} newer_than:7d`;
  const listParams = new URLSearchParams({
    maxResults: String(maxResults),
    q: query,
  });

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listResponse.ok) {
    throw new Error(`Gmail API error: ${await listResponse.text()}`);
  }

  const listData = await listResponse.json();
  if (!listData.messages?.length) return [];

  const messages = await Promise.all(
    listData.messages.map(async (msg: { id: string }) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      return await res.json();
    })
  );

  return messages.filter(Boolean) as GmailMessage[];
}

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

  const prompt = `You are an AI assistant for a rebar fabrication company. Analyze this email sent to rfq@rebar.shop and determine if it's a legitimate Request for Quotation (RFQ) or business lead.

EMAIL:
From: ${from}
Subject: ${subject}
Body:
${body.substring(0, 3000)}

Analyze and respond using the suggest_lead tool. An email IS a lead if it:
- Requests a quote or pricing for rebar/steel/fabrication work
- Inquires about services, projects, or capabilities
- Is from a construction company, contractor, or engineer asking about rebar

An email is NOT a lead if it:
- Is spam, marketing, or automated notifications
- Is an internal/system email
- Is a newsletter or promotional content
- Is a reply to an existing conversation that doesn't contain new business`;

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
            description: "Extract lead information from an RFQ email",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
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

    // Step 1: Fetch recent emails to rfq@rebar.shop
    console.log("Fetching emails to rfq@rebar.shop...");
    const accessToken = await getAccessToken();
    const emails = await fetchRecentEmails(accessToken);
    console.log(`Found ${emails.length} emails`);

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, skipped: 0, filtered: 0, leads: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Check which emails have already been processed
    const emailIds = emails.map((e) => `gmail_rfq_${e.id}`);
    const { data: existingLeads } = await supabaseAdmin
      .from("leads")
      .select("source_email_id")
      .in("source_email_id", emailIds);

    const processedIds = new Set((existingLeads ?? []).map((l) => l.source_email_id));

    // Step 3: Process unprocessed emails with AI
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

    for (const email of emails) {
      const sourceEmailId = `gmail_rfq_${email.id}`;

      if (processedIds.has(sourceEmailId)) {
        skipped++;
        results.push({
          emailId: email.id,
          from: getHeader(email.payload.headers, "From"),
          subject: getHeader(email.payload.headers, "Subject"),
          action: "skipped",
        });
        continue;
      }

      const from = getHeader(email.payload.headers, "From");
      const subject = getHeader(email.payload.headers, "Subject");
      const body = getBodyContent(email);

      try {
        const analysis = await analyzeEmailWithAI(subject, from, body);

        if (!analysis.is_lead) {
          filtered++;
          results.push({ emailId: email.id, from, subject, action: "filtered", lead: analysis });
          continue;
        }

        // Extract sender email from "Name <email>" format
        const senderEmail = from.match(/<(.+?)>/)?.[1] || from;

        // Create the lead
        const { error: insertError } = await supabaseAdmin.from("leads").insert({
          title: analysis.title,
          description: analysis.description,
          stage: "new",
          source: `Email: ${senderEmail}`,
          source_email_id: sourceEmailId,
          priority: analysis.priority,
          expected_value: analysis.expected_value,
          company_id: profile.company_id,
          notes: `Auto-created from RFQ email.\nFrom: ${from}\nSubject: ${subject}\nCompany: ${analysis.sender_company}\nAI Reason: ${analysis.reason}`,
        });

        if (insertError) {
          console.error("Failed to insert lead:", insertError);
          // If it's a duplicate, just skip
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
        // Don't block on AI errors, skip this email
        continue;
      }
    }

    console.log(`Done: ${created} created, ${skipped} skipped, ${filtered} filtered`);

    return new Response(
      JSON.stringify({
        created,
        skipped,
        filtered,
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
