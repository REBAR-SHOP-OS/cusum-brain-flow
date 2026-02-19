import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RC_SERVER = "https://platform.ringcentral.com";

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

async function getRCAccessTokenForUser(userId: string): Promise<string> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow, error } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow?.access_token) {
    throw new Error("RingCentral not connected. Please connect RingCentral in Integrations.");
  }

  // Check if token is expired and refresh if needed
  const expiresAt = new Date(tokenRow.token_expires_at).getTime();
  if (Date.now() < expiresAt - 60000) {
    return tokenRow.access_token;
  }

  // Refresh the token
  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("RC OAuth credentials not configured");

  const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`);

  const tokens = await resp.json();
  await supabaseAdmin
    .from("user_ringcentral_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return tokens.access_token;
}

async function downloadRecording(
  accessToken: string,
  contentUri: string
): Promise<{ base64: string; mimeType: string }> {
  const resp = await fetch(contentUri, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    throw new Error(`Failed to download recording: ${resp.status}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Convert to base64
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mimeType = resp.headers.get("Content-Type") || "audio/mpeg";

  return { base64, mimeType };
}

async function analyzeWithGemini(
  audioBase64: string,
  mimeType: string,
  fromNumber: string,
  toNumber: string
): Promise<any> {
  const systemPrompt = `You are a call analysis assistant. You will receive an audio recording of a phone call.
Your task is to:
1. Transcribe the conversation with speaker identification (label speakers as "0", "1", etc.)
2. Provide a quick summary (2-3 sentences) and a detailed summary (1-2 paragraphs)
3. Extract key highlights (important quotes or moments)
4. Analyze speaker insights (sentiment, approximate talk ratio)
5. Extract actionable tasks from the conversation

Be accurate and thorough. For speaker identification, try to distinguish different voices.
Return your analysis using the provided tool.`;

  const userPrompt = `Analyze this phone call recording between ${fromNumber} and ${toNumber}. Provide complete transcription with speaker identification, summaries, insights, and action items.`;

  const analysisToolSchema = {
    type: "function",
    function: {
      name: "call_analysis_result",
      description: "Return the complete analysis of the call recording",
      parameters: {
        type: "object",
        properties: {
          transcript: { type: "string", description: "Full text transcription of the call" },
          utterances: {
            type: "array",
            description: "Individual utterances with speaker identification",
            items: {
              type: "object",
              properties: {
                speakerId: { type: "string", description: "Speaker identifier: '0' for first speaker, '1' for second, etc." },
                text: { type: "string", description: "What was said" },
              },
              required: ["speakerId", "text"],
              additionalProperties: false,
            },
          },
          quickSummary: { type: "string", description: "2-3 sentence summary of the call" },
          detailedSummary: { type: "string", description: "1-2 paragraph detailed summary" },
          keyHighlights: { type: "array", description: "Key quotes or moments from the call", items: { type: "string" } },
          speakers: {
            type: "array",
            description: "Insights for each speaker",
            items: {
              type: "object",
              properties: {
                speakerId: { type: "string" },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
                talkRatio: { type: "number", description: "Approximate percentage of time this speaker talked (0-1)" },
                energy: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["speakerId", "sentiment", "talkRatio"],
              additionalProperties: false,
            },
          },
          overallSentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
          tasks: {
            type: "array",
            description: "Actionable tasks extracted from the conversation. Only genuine action items.",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["title", "description", "priority"],
              additionalProperties: false,
            },
          },
        },
        required: ["transcript", "utterances", "quickSummary", "detailedSummary", "keyHighlights", "speakers", "overallSentiment", "tasks"],
        additionalProperties: false,
      },
    },
  };

  const audioDataUri = `data:${mimeType};base64,${audioBase64}`;

  const result = await callAI({
    provider: "gemini",
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: audioDataUri } },
        ],
      },
    ],
    tools: [analysisToolSchema],
    toolChoice: { type: "function", function: { name: "call_analysis_result" } },
    temperature: 0.2,
  });

  const toolCall = result.toolCalls[0];
  if (!toolCall?.function?.arguments) {
    // Fallback: try to parse from content
    const cleaned = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI analysis result");
    }
  }

  return JSON.parse(toolCall.function.arguments);
}

function formatToFrontendResponse(analysis: any) {
  return {
    transcription: {
      transcript: analysis.transcript || "",
      confidence: 0.9, // Gemini doesn't provide confidence scores
      utterances: (analysis.utterances || []).map(
        (u: any, i: number) => ({
          speakerId: u.speakerId || "0",
          text: u.text || "",
          start: undefined,
          end: undefined,
          confidence: undefined,
        })
      ),
    },
    interaction: {
      speakerInsights: (analysis.speakers || []).reduce(
        (acc: any, s: any) => {
          acc[s.speakerId] = {
            talkToListenRatio: s.talkRatio,
            sentiment: s.sentiment,
            energy: s.energy || "medium",
          };
          return acc;
        },
        {}
      ),
      conversationalInsights: [
        {
          name: "Overall Sentiment",
          value: analysis.overallSentiment || "neutral",
        },
      ],
      utterances: [],
    },
    summary: {
      abstractiveShort: analysis.quickSummary
        ? [{ value: analysis.quickSummary }]
        : [],
      abstractiveLong: analysis.detailedSummary
        ? [{ value: analysis.detailedSummary }]
        : [],
      extractive: (analysis.keyHighlights || []).map((h: string) => ({
        value: h,
      })),
    },
    tasks: analysis.tasks || [],
  };
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
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limit: 5 requests per 60 seconds per user (expensive audio analysis)
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: userId,
      _function_name: "ringcentral-ai",
      _max_requests: 5,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recordingUri, analysisType, fromNumber, toNumber } =
      await req.json();

    if (!recordingUri) {
      return new Response(
        JSON.stringify({ error: "recordingUri is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Downloading recording from RingCentral...");
    const accessToken = await getRCAccessTokenForUser(userId);
    const { base64, mimeType } = await downloadRecording(
      accessToken,
      recordingUri
    );
    console.log(
      `Recording downloaded: ${Math.round(base64.length / 1024)}KB, type: ${mimeType}`
    );

    console.log("Sending to Gemini for analysis...");
    const analysis = await analyzeWithGemini(
      base64,
      mimeType,
      fromNumber || "Unknown",
      toNumber || "Unknown"
    );
    console.log("Analysis complete");

    const response = formatToFrontendResponse(analysis);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Call analysis error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
