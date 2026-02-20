import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { optionalAuth, corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

interface VisionRequest {
  imageUrl?: string;
  imageBase64?: string;
  mode?: "standard" | "deep";   // deep = quadrant-based multi-pass
  quadrants?: 4 | 9;            // 4 = 2x2, 9 = 3x3
  features?: string[];
}

const QUADRANT_POSITIONS_4 = ["TOP-LEFT", "TOP-RIGHT", "BOTTOM-LEFT", "BOTTOM-RIGHT"];
const QUADRANT_POSITIONS_9 = [
  "TOP-LEFT", "TOP-CENTER", "TOP-RIGHT",
  "MIDDLE-LEFT", "MIDDLE-CENTER", "MIDDLE-RIGHT",
  "BOTTOM-LEFT", "BOTTOM-CENTER", "BOTTOM-RIGHT",
];

function buildQuadrantPrompt(position: string): string {
  return `You are a Senior Structural Estimator analyzing a construction/shop drawing.
FOCUS ONLY on the ${position} quadrant/section of this image.
Extract EVERY piece of text, number, dimension, bar mark, and notation visible in that area with 100% accuracy.

Look specifically for:
- Rebar notation (e.g., "7-20M B.E.W.", "4-15M @ 300 c/c")
- Bar marks (A, B1, W3, etc.)
- Dimensions in mm or m
- Schedule tables (Foundation/Pier/Column/Beam/Slab schedules)
- Scale annotations
- Drawing numbers and revision marks
- General notes and specifications
- Member sizes and grades (e.g., 400W)

Output ALL text exactly as it appears. Preserve table structure using pipes (|) and dashes (-).
Do NOT summarize or paraphrase — extract verbatim.`;
}

const FULL_SCAN_PROMPT = `You are a Senior Structural Estimator analyzing a construction/shop drawing.
Extract ALL text, dimensions, schedules, notes, and specifications from this entire document with 100% accuracy.
FOCUS ON: Foundation/Pier/Column/Beam/Slab Schedules, General Notes, Scale, Dimensions, Bar Marks, Rebar Notation.
Output ALL text exactly as it appears. Preserve table structure. Do NOT summarize.`;

const STANDARD_PROMPT = "Extract ALL text from this image exactly as it appears, preserving layout and structure. Return only the extracted text, nothing else.";

function deduplicateText(texts: string[]): string {
  const allLines: string[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Normalize whitespace for dedup comparison
      const normalized = trimmed.replace(/\s+/g, " ").toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        allLines.push(trimmed);
      }
    }
  }
  return allLines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await optionalAuth(req);
    const isInternalCall = req.headers.get("apikey") === Deno.env.get("SUPABASE_ANON_KEY");
    if (!userId && !isInternalCall) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageUrl, imageBase64, mode = "standard", quadrants = 4 }: VisionRequest = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Either imageUrl or imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageContent = imageUrl
      ? { type: "image_url" as const, image_url: { url: imageUrl } }
      : { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

    // Standard mode — single pass with Flash
    if (mode !== "deep") {
      const result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: [{ type: "text", text: STANDARD_PROMPT }, imageContent] }],
      });

      return new Response(
        JSON.stringify({ fullText: result.content, textBlocks: [], mode: "standard" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════
    // DEEP MODE — Multi-pass quadrant scanning
    // ═══════════════════════════════════════
    console.log(`🔬 Deep OCR: ${quadrants} quadrants`);
    const positions = quadrants === 9 ? QUADRANT_POSITIONS_9 : QUADRANT_POSITIONS_4;
    const extractedTexts: string[] = [];

    // Pass 1: Full image scan for layout context (Gemini Pro)
    try {
      const fullResult = await callAI({
        provider: "gemini",
        model: "gemini-2.5-pro",
        messages: [{ role: "user", content: [{ type: "text", text: FULL_SCAN_PROMPT }, imageContent] }],
        maxTokens: 8000,
        temperature: 0.1,
      });
      extractedTexts.push(fullResult.content);
      console.log(`  ✓ Full scan: ${fullResult.content.length} chars`);
    } catch (e) {
      console.error("Full scan failed:", e);
    }

    // Pass 2-N: Quadrant-focused scans (Gemini Pro)
    for (const position of positions) {
      try {
        const quadResult = await callAI({
          provider: "gemini",
          model: "gemini-2.5-pro",
          messages: [{
            role: "user",
            content: [{ type: "text", text: buildQuadrantPrompt(position) }, imageContent],
          }],
          maxTokens: 4000,
          temperature: 0.1,
        });
        extractedTexts.push(quadResult.content);
        console.log(`  ✓ ${position}: ${quadResult.content.length} chars`);
      } catch (e) {
        console.error(`Quadrant ${position} failed:`, e);
      }
    }

    // Merge & deduplicate
    const mergedText = deduplicateText(extractedTexts);
    console.log(`🔬 Deep OCR complete: ${mergedText.length} chars merged from ${extractedTexts.length} passes`);

    return new Response(
      JSON.stringify({
        fullText: mergedText,
        textBlocks: [],
        mode: "deep",
        passes: extractedTexts.length,
        quadrants,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("OCR error:", error);
    if (error instanceof AIError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
