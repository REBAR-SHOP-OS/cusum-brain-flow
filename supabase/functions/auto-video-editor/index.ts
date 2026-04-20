// Auto Video Editor — analyze raw user video and propose a storyboard
// SILENT VIDEO POLICY: this function never returns audio/music suggestions.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalyzePayload {
  action: "analyze";
  // Public/signed URL for an array of pre-extracted frame thumbnails (data URLs ok)
  frames: { t: number; dataUrl: string }[];
  videoDuration: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Entry log so we can verify requests are reaching the function
  const contentLength = Number(req.headers.get("content-length") || 0);
  console.log(`[auto-video-editor] ${req.method} content-length=${contentLength}`);

  // Hard guard: reject anything above 5MB to avoid CDN/edge cutoff (limit is ~6MB)
  if (contentLength > 5 * 1024 * 1024) {
    return json(
      {
        error:
          "Video payload too large. Please use a shorter clip or try again — the AI received too much data.",
      },
      413,
    );
  }

  try {
    const body = await req.json();
    if (body?.action !== "analyze") {
      return json({ error: "Unsupported action" }, 400);
    }

    const { frames, videoDuration } = body as AnalyzePayload;
    if (!Array.isArray(frames) || frames.length === 0) {
      return json({ error: "frames[] required" }, 400);
    }
    if (!videoDuration || videoDuration <= 0) {
      return json({ error: "videoDuration required" }, 400);
    }

    console.log(`[auto-video-editor] analyze frames=${frames.length} duration=${videoDuration.toFixed(1)}s`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    // Build vision messages — cap at 16 frames to stay within token limits
    const sampled = downsampleFrames(frames, 16);
    const userContent: any[] = [
      {
        type: "text",
        text:
          `You are a B2B video editor assistant. The user uploaded a raw video that is ${videoDuration.toFixed(1)} seconds long.\n` +
          `You are seeing ${sampled.length} keyframes evenly sampled from the video. Each frame is labeled with its timestamp (seconds).\n\n` +
          `TASK: Propose a tight, edited storyboard of 4–10 scenes that uses the BEST moments of this footage. ` +
          `Each scene must be a contiguous sub-clip of the source video (start < end, both within 0..${videoDuration.toFixed(2)}s). ` +
          `Scenes must NOT overlap and should be ordered chronologically by 'start'. ` +
          `Aim for scenes between 1.5s and 6s. Skip boring/blurry/duplicate frames.\n\n` +
          `IMPORTANT: The final video will be SILENT (no audio). Do not propose voiceover or music. Focus only on visuals.\n\n` +
          `Return ONLY via the propose_storyboard tool.`,
      },
      ...sampled.map((f) => ({
        type: "image_url" as const,
        image_url: { url: f.dataUrl },
      })),
      {
        type: "text",
        text:
          `Frame timestamps (in order): ${sampled.map((f) => f.t.toFixed(2) + "s").join(", ")}.`,
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a precise video editor that returns structured storyboards via the provided tool. Never include audio or music suggestions.",
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_storyboard",
              description: "Return a sequence of contiguous, non-overlapping scene cuts.",
              parameters: {
                type: "object",
                properties: {
                  scenes: {
                    type: "array",
                    minItems: 3,
                    maxItems: 12,
                    items: {
                      type: "object",
                      properties: {
                        start: { type: "number", description: "Start time in seconds." },
                        end: { type: "number", description: "End time in seconds. Must be > start." },
                        description: {
                          type: "string",
                          description: "Short description of what's in this scene (max 80 chars).",
                        },
                      },
                      required: ["start", "end", "description"],
                      additionalProperties: false,
                    },
                  },
                  summary: {
                    type: "string",
                    description: "One-sentence summary of the proposed edit.",
                  },
                },
                required: ["scenes", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_storyboard" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      if (aiResp.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI analysis failed" }, 500);
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return json({ error: "AI returned no storyboard" }, 500);
    }

    let parsed: { scenes: { start: number; end: number; description: string }[]; summary: string };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (_e) {
      return json({ error: "Malformed AI output" }, 500);
    }

    // Sanitize: clamp, sort, deduplicate, enforce min length
    const cleaned = (parsed.scenes || [])
      .map((s) => ({
        start: Math.max(0, Math.min(videoDuration, Number(s.start) || 0)),
        end: Math.max(0, Math.min(videoDuration, Number(s.end) || 0)),
        description: String(s.description || "").slice(0, 120),
      }))
      .filter((s) => s.end - s.start >= 0.8)
      .sort((a, b) => a.start - b.start);

    // Deoverlap
    for (let i = 1; i < cleaned.length; i++) {
      if (cleaned[i].start < cleaned[i - 1].end) {
        cleaned[i].start = cleaned[i - 1].end;
      }
    }
    const final = cleaned.filter((s) => s.end - s.start >= 0.8).slice(0, 12);

    if (final.length === 0) {
      return json({ error: "AI did not produce any usable scenes" }, 500);
    }

    return json({
      scenes: final,
      summary: parsed.summary || "Auto-generated edit",
    });
  } catch (err) {
    console.error("auto-video-editor error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function downsampleFrames<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
