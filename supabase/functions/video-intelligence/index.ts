import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireAuth, optionalAuth, corsHeaders, json } from "../_shared/auth.ts";

const API_BASE = "https://videointelligence.googleapis.com/v1";

interface AnnotateRequest {
  action: "annotate" | "poll";
  videoUrl?: string;
  operationName?: string;
  features?: string[];
}

const DEFAULT_FEATURES = [
  "LABEL_DETECTION",
  "EXPLICIT_CONTENT_DETECTION",
  "SPEECH_TRANSCRIPTION",
  "SHOT_CHANGE_DETECTION",
  "TEXT_DETECTION",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await optionalAuth(req);
    const isInternal = req.headers.get("apikey") === Deno.env.get("SUPABASE_ANON_KEY");
    if (!userId && !isInternal) {
      return json({ error: "Unauthorized" }, 401);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "GEMINI_API_KEY not configured" }, 500);
    }

    const body: AnnotateRequest = await req.json();

    // ─── POLL for operation result ───
    if (body.action === "poll") {
      if (!body.operationName) {
        return json({ error: "operationName required for poll" }, 400);
      }

      const pollUrl = `${API_BASE}/${body.operationName}?key=${apiKey}`;
      const pollRes = await fetch(pollUrl);
      const pollData = await pollRes.json();

      if (!pollRes.ok) {
        return json({ error: pollData.error?.message || "Poll failed" }, pollRes.status);
      }

      if (!pollData.done) {
        return json({ done: false, operationName: body.operationName });
      }

      // Parse completed results
      const result = pollData.response?.annotationResults?.[0];
      if (!result) {
        return json({ done: true, results: null, error: "No annotation results" });
      }

      const parsed = {
        labels: (result.segmentLabelAnnotations || []).map((l: any) => ({
          name: l.entity?.description || "",
          confidence: l.segments?.[0]?.confidence || 0,
          category: l.categoryEntities?.[0]?.description || null,
        })),
        moderation: (result.explicitAnnotation?.frames || []).map((f: any) => ({
          timeOffset: parseTimeOffset(f.timeOffset),
          pornographyLikelihood: f.pornographyLikelihood || "UNKNOWN",
        })),
        transcript: (result.speechTranscriptions || []).flatMap((t: any) =>
          (t.alternatives || []).map((alt: any) => ({
            transcript: alt.transcript || "",
            confidence: alt.confidence || 0,
            words: (alt.words || []).map((w: any) => ({
              word: w.word,
              startTime: parseTimeOffset(w.startTime),
              endTime: parseTimeOffset(w.endTime),
            })),
          }))
        ),
        shots: (result.shotAnnotations || []).map((s: any) => ({
          startTime: parseTimeOffset(s.startTimeOffset),
          endTime: parseTimeOffset(s.endTimeOffset),
        })),
        textAnnotations: (result.textAnnotations || []).map((t: any) => ({
          text: t.text || "",
          segments: (t.segments || []).map((seg: any) => ({
            startTime: parseTimeOffset(seg.segment?.startTimeOffset),
            endTime: parseTimeOffset(seg.segment?.endTimeOffset),
            confidence: seg.confidence || 0,
          })),
        })),
      };

      // Determine moderation status
      const flaggedLevels = ["LIKELY", "VERY_LIKELY"];
      const isFlagged = parsed.moderation.some((m: any) =>
        flaggedLevels.includes(m.pornographyLikelihood)
      );

      return json({
        done: true,
        results: parsed,
        moderationStatus: isFlagged ? "flagged" : "safe",
        suggestedHashtags: parsed.labels
          .filter((l: any) => l.confidence > 0.7)
          .slice(0, 8)
          .map((l: any) => `#${l.name.replace(/\s+/g, "")}`),
      });
    }

    // ─── ANNOTATE — submit new job ───
    if (!body.videoUrl) {
      return json({ error: "videoUrl required" }, 400);
    }

    const features = (body.features || DEFAULT_FEATURES).map((f) => ({
      type: f,
      ...(f === "SPEECH_TRANSCRIPTION"
        ? { videoContext: { speechTranscriptionConfig: { languageCode: "en-US", enableAutomaticPunctuation: true } } }
        : {}),
    }));

    const annotateUrl = `${API_BASE}/videos:annotate?key=${apiKey}`;
    const annotateBody = {
      inputUri: body.videoUrl,
      features: features.map((f) => f.type),
      videoContext: {
        speechTranscriptionConfig: {
          languageCode: "en-US",
          enableAutomaticPunctuation: true,
        },
      },
    };

    // If the URL is not a GCS URI, use inputContent via base64
    if (!body.videoUrl.startsWith("gs://")) {
      // Fetch video and convert to base64
      console.log("Fetching video for base64 encoding...");
      const videoRes = await fetch(body.videoUrl);
      if (!videoRes.ok) {
        return json({ error: "Failed to fetch video URL" }, 400);
      }
      const videoBuffer = await videoRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(videoBuffer)));
      delete (annotateBody as any).inputUri;
      (annotateBody as any).inputContent = base64;
    }

    const annotateRes = await fetch(annotateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annotateBody),
    });

    const annotateData = await annotateRes.json();

    if (!annotateRes.ok) {
      console.error("Annotate API error:", JSON.stringify(annotateData));
      return json({ error: annotateData.error?.message || "Video Intelligence API error" }, annotateRes.status);
    }

    return json({
      operationName: annotateData.name,
      done: false,
    });

  } catch (error) {
    console.error("video-intelligence error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function parseTimeOffset(offset: any): number {
  if (!offset) return 0;
  const seconds = parseInt(offset.seconds || "0", 10);
  const nanos = parseInt(offset.nanos || "0", 10);
  return seconds + nanos / 1e9;
}
