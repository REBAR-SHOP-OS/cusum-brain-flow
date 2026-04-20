// Auto Video Editor — analyze raw user video(s) and propose a storyboard
// SILENT VIDEO POLICY: this function never returns audio/music suggestions.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClipPayload {
  index: number;
  duration: number;
  frames: { t: number; dataUrl: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const contentLength = Number(req.headers.get("content-length") || 0);
  console.log(`[auto-video-editor] ${req.method} content-length=${contentLength}`);

  if (contentLength > 5 * 1024 * 1024) {
    return json(
      {
        error:
          "Video payload too large. Please use shorter clips or fewer of them — the AI received too much data.",
      },
      413,
    );
  }

  try {
    const body = await req.json();
    if (body?.action !== "analyze") {
      return json({ error: "Unsupported action" }, 400);
    }

    const userDirection: string = typeof body.userDirection === "string" ? body.userDirection.trim().slice(0, 600) : "";

    // Normalize: accept either { clips: [...] } (multi) or legacy { frames, videoDuration }
    let clips: ClipPayload[] = [];
    if (Array.isArray(body.clips) && body.clips.length > 0) {
      clips = body.clips
        .map((c: any, i: number) => ({
          index: typeof c.index === "number" ? c.index : i,
          duration: Number(c.duration) || 0,
          frames: Array.isArray(c.frames) ? c.frames : [],
        }))
        .filter((c: ClipPayload) => c.frames.length > 0 && c.duration > 0);
    } else if (Array.isArray(body.frames) && body.frames.length > 0 && Number(body.videoDuration) > 0) {
      clips = [{ index: 0, duration: Number(body.videoDuration), frames: body.frames }];
    }

    if (clips.length === 0) {
      return json({ error: "clips[] (or frames + videoDuration) required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    console.log(
      `[auto-video-editor] analyze clips=${clips.length} totalFrames=${clips.reduce((a, c) => a + c.frames.length, 0)} totalDuration=${clips.reduce((a, c) => a + c.duration, 0).toFixed(1)}s`,
    );

    // Cap total frames sent to the LLM to ~24 to stay within token limits
    const MAX_TOTAL = 24;
    const totalFrames = clips.reduce((a, c) => a + c.frames.length, 0);
    if (totalFrames > MAX_TOTAL) {
      const ratio = MAX_TOTAL / totalFrames;
      clips = clips.map((c) => ({
        ...c,
        frames: downsample(c.frames, Math.max(3, Math.floor(c.frames.length * ratio))),
      }));
    }

    const totalDuration = clips.reduce((a, c) => a + c.duration, 0);
    const isMulti = clips.length > 1;

    const userContent: any[] = [
      {
        type: "text",
        text:
          `You are a B2B video editor assistant. The user uploaded ${clips.length} raw clip${isMulti ? "s" : ""} (combined ${totalDuration.toFixed(1)}s).\n` +
          `For each clip, you will see keyframes labeled with their clip index and timestamp within that clip.\n\n` +
          `TASK: Propose a tight, edited storyboard of 4–10 scenes that uses the BEST moments across ALL clips. ` +
          `Each scene must be a contiguous sub-clip of ONE source clip. ` +
          `For each scene, return: clipIndex (0-based, which source clip it comes from), start (sec, within that clip), end (sec, within that clip), and a short description. ` +
          `start < end, both within 0..duration of that clip. Aim for scenes between 1.5s and 6s. Skip boring/blurry/duplicate frames. ` +
          `${isMulti ? "Mix scenes from different clips when it produces a stronger narrative." : ""}\n\n` +
          `IMPORTANT: The final video will be SILENT. Do not propose voiceover or music. Focus only on visuals.\n\n` +
          `Return ONLY via the propose_storyboard tool.`,
      },
    ];

    for (const c of clips) {
      userContent.push({
        type: "text",
        text: `--- Clip ${c.index} (duration ${c.duration.toFixed(2)}s) ---`,
      });
      for (const f of c.frames) {
        userContent.push({
          type: "image_url" as const,
          image_url: { url: f.dataUrl },
        });
      }
      userContent.push({
        type: "text",
        text: `(Clip ${c.index} timestamps: ${c.frames.map((f) => f.t.toFixed(2) + "s").join(", ")})`,
      });
    }

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
              description: "Return a sequence of scene cuts, each tied to a specific source clip.",
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
                        clipIndex: { type: "number", description: "0-based index of the source clip." },
                        start: { type: "number", description: "Start time in seconds within the source clip." },
                        end: { type: "number", description: "End time in seconds within the source clip. Must be > start." },
                        description: {
                          type: "string",
                          description: "Short description of what's in this scene (max 80 chars).",
                        },
                      },
                      required: ["clipIndex", "start", "end", "description"],
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

    let parsed: {
      scenes: { clipIndex: number; start: number; end: number; description: string }[];
      summary: string;
    };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (_e) {
      return json({ error: "Malformed AI output" }, 500);
    }

    const clipDurations = new Map(clips.map((c) => [c.index, c.duration]));

    // Sanitize per scene
    const cleaned = (parsed.scenes || [])
      .map((s) => {
        const ci = Math.max(0, Math.min(clips.length - 1, Math.floor(Number(s.clipIndex) || 0)));
        // map back to provided clip index (it might not be 0..n-1 if the client is weird)
        const clipDur = clipDurations.get(clips[ci].index) ?? clips[ci].duration;
        return {
          clipIndex: ci,
          start: Math.max(0, Math.min(clipDur, Number(s.start) || 0)),
          end: Math.max(0, Math.min(clipDur, Number(s.end) || 0)),
          description: String(s.description || "").slice(0, 120),
        };
      })
      .filter((s) => s.end - s.start >= 0.8);

    // De-overlap within each clip
    const byClip = new Map<number, typeof cleaned>();
    for (const s of cleaned) {
      if (!byClip.has(s.clipIndex)) byClip.set(s.clipIndex, []);
      byClip.get(s.clipIndex)!.push(s);
    }
    for (const list of byClip.values()) {
      list.sort((a, b) => a.start - b.start);
      for (let i = 1; i < list.length; i++) {
        if (list[i].start < list[i - 1].end) list[i].start = list[i - 1].end;
      }
    }

    // Preserve the AI-provided order across clips
    const orderedFinal = cleaned
      .filter((s) => s.end - s.start >= 0.8)
      .slice(0, 12);

    if (orderedFinal.length === 0) {
      return json({ error: "AI did not produce any usable scenes" }, 500);
    }

    return json({
      scenes: orderedFinal,
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

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
