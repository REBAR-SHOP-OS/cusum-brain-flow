import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RC_SERVER = "https://platform.ringcentral.com";
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 3000;

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

async function getRCAccessToken(): Promise<string> {
  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
  const jwt = Deno.env.get("RINGCENTRAL_JWT");

  if (!clientId || !clientSecret || !jwt) {
    throw new Error("RingCentral credentials not configured");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`RC token exchange failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function pollJobResult(accessToken: string, jobId: string): Promise<any> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const resp = await fetch(`${RC_SERVER}/ai/status/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      throw new Error(`Job status check failed: ${resp.status}`);
    }

    const data = await resp.json();

    if (data.status === "Success") {
      return data.response;
    }
    if (data.status === "Failed") {
      throw new Error(`AI job failed: ${JSON.stringify(data)}`);
    }
    // Otherwise InProgress, continue polling
  }
  throw new Error("AI job timed out after polling");
}

// ----- Speech-to-Text with Speaker Diarization -----
async function transcribeRecording(
  accessToken: string,
  contentUri: string
): Promise<any> {
  const resp = await fetch(
    `${RC_SERVER}/ai/audio/v1/async/speech-to-text`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentUri,
        encoding: "Mpeg",
        languageCode: "en-US",
        source: "RingCentral",
        audioType: "CallCenter",
        enablePunctuation: true,
        enableSpeakerDiarization: true,
        enableVoiceActivityDetection: true,
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Speech-to-text submission failed [${resp.status}]: ${errText}`);
  }

  const data = await resp.json();
  if (!data.jobId) throw new Error("No jobId returned from speech-to-text");
  return pollJobResult(accessToken, data.jobId);
}

// ----- Interaction Analytics -----
async function analyzeInteraction(
  accessToken: string,
  contentUri: string
): Promise<any> {
  const resp = await fetch(
    `${RC_SERVER}/ai/insights/v1/async/analyze-interaction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentUri,
        encoding: "Mpeg",
        languageCode: "en-US",
        source: "RingCentral",
        audioType: "CallCenter",
        insights: ["All"],
        enableVoiceActivityDetection: true,
        separateSpeakerPerChannel: true,
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Interaction analytics submission failed [${resp.status}]: ${errText}`);
  }

  const data = await resp.json();
  if (!data.jobId) throw new Error("No jobId returned from interaction analytics");
  return pollJobResult(accessToken, data.jobId);
}

// ----- Conversation Summary -----
async function summarizeConversation(
  accessToken: string,
  utterances: Array<{ speakerId: string; text: string; start?: number; end?: number }>
): Promise<any> {
  const resp = await fetch(
    `${RC_SERVER}/ai/text/v1/async/summarize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summaryType: "All",
        utterances,
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Summarization submission failed [${resp.status}]: ${errText}`);
  }

  const data = await resp.json();
  if (!data.jobId) throw new Error("No jobId returned from summarization");
  return pollJobResult(accessToken, data.jobId);
}

// ----- Use Lovable AI to extract tasks from summary -----
async function extractTasks(
  summary: string,
  fromNumber: string,
  toNumber: string
): Promise<{ tasks: Array<{ title: string; description: string; priority: string }> }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { tasks: [] };

  const systemPrompt = `You are a task extraction assistant. Given a call summary and transcript highlights, extract actionable tasks.
Return a JSON object: { "tasks": [{ "title": "...", "description": "...", "priority": "high"|"medium"|"low" }] }
Rules:
- Only genuine action items, not observations
- Tasks should be specific and actionable
- "high" for urgent/time-sensitive, "medium" for normal, "low" for nice-to-have
- Return ONLY valid JSON`;

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Call between ${fromNumber} and ${toNumber}:\n\n${summary}`,
          },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) return { tasks: [] };

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { tasks: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recordingUri, analysisType, fromNumber, toNumber } = await req.json();

    if (!recordingUri) {
      return new Response(
        JSON.stringify({ error: "recordingUri is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getRCAccessToken();

    // Determine what to run based on analysisType
    const type = analysisType || "full"; // "transcribe", "analytics", "summary", "full"

    let transcription = null;
    let interaction = null;
    let summary = null;
    let tasks = null;

    if (type === "transcribe" || type === "full") {
      console.log("Starting speech-to-text...");
      transcription = await transcribeRecording(accessToken, recordingUri);
    }

    if (type === "analytics" || type === "full") {
      console.log("Starting interaction analytics...");
      try {
        interaction = await analyzeInteraction(accessToken, recordingUri);
      } catch (err) {
        console.error("Interaction analytics failed (non-fatal):", err);
        // Non-fatal — continue with other analyses
      }
    }

    // Summarize using RC AI if we have utterances from transcription
    if ((type === "summary" || type === "full") && transcription?.utterances?.length > 0) {
      console.log("Starting conversation summary...");
      try {
        const utterancesForSummary = transcription.utterances.map((u: any) => ({
          speakerId: u.speakerId || "0",
          text: u.text,
          start: u.start,
          end: u.end,
        }));
        summary = await summarizeConversation(accessToken, utterancesForSummary);
      } catch (err) {
        console.error("Summarization failed (non-fatal):", err);
      }
    }

    // Extract tasks using Lovable AI
    if (type === "full") {
      const summaryText =
        summary?.abstractiveLong ||
        summary?.abstractiveShort ||
        transcription?.transcript ||
        "";
      if (summaryText.length > 20) {
        console.log("Extracting tasks...");
        const taskResult = await extractTasks(
          summaryText,
          fromNumber || "Unknown",
          toNumber || "Unknown"
        );
        tasks = taskResult.tasks;
      }
    }

    return new Response(
      JSON.stringify({
        transcription: transcription
          ? {
              transcript: transcription.transcript,
              confidence: transcription.confidence,
              utterances: transcription.utterances?.map((u: any) => ({
                speakerId: u.speakerId,
                text: u.text,
                start: u.start,
                end: u.end,
                confidence: u.confidence,
              })),
            }
          : null,
        interaction: interaction
          ? {
              speakerInsights: interaction.speakerInsights,
              conversationalInsights: interaction.conversationalInsights,
              utterances: interaction.utterances?.map((u: any) => ({
                speakerId: u.speakerId,
                text: u.text,
                start: u.start,
                end: u.end,
                sentiment: u.sentiment,
              })),
            }
          : null,
        summary: summary
          ? {
              abstractiveShort: summary.summaries?.find((s: any) => s.name === "AbstractiveShort")?.values || [],
              abstractiveLong: summary.summaries?.find((s: any) => s.name === "AbstractiveLong")?.values || [],
              extractive: summary.summaries?.find((s: any) => s.name === "Extractive")?.values || [],
            }
          : null,
        tasks: tasks || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RingCentral AI error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
