import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

serve((req) =>
  handleRequest(req, async (ctx) => {
    const { photo_storage_path, expected_mark_number, expected_drawing_ref, photo_type } = ctx.body;

    if (!photo_storage_path) {
      return new Response(JSON.stringify({ error: "photo_storage_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedData, error: signedErr } = await ctx.serviceClient.storage
      .from("clearance-photos")
      .createSignedUrl(photo_storage_path, 300);

    if (signedErr || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Could not access photo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const photoUrl = signedData.signedUrl;

    const systemPrompt = `You are a QC validation assistant for a rebar fabrication shop. You analyze photos of rebar items (material photos or tag/label scans) to verify they match expected identifiers.

Your task: Look at the photo and try to identify any visible mark numbers, label marks, drawing references, or tag identifiers.

Rules:
- For TAG SCAN photos: Look for printed/written text on tags, labels, stickers, or stamps showing mark numbers (e.g. "A1001") and drawing references (e.g. "SD01")
- For MATERIAL photos: Look for any visible markings, stamps, paint marks, or tags attached to the rebar material
- Be lenient with partial matches (e.g. "1001" matches "A1001")
- If you cannot read any text clearly, say so
- Return your analysis as JSON only`;

    const userPrompt = `Analyze this ${photo_type === "tag" ? "tag scan" : "material"} photo.

Expected mark number: "${expected_mark_number || "unknown"}"
Expected drawing reference: "${expected_drawing_ref || "unknown"}"

Extract any visible text/identifiers from the photo and determine if they match the expected values.

Return ONLY valid JSON in this format:
{
  "detected_mark": "text you found or null",
  "detected_drawing": "text you found or null",
  "mark_match": true/false,
  "drawing_match": true/false,
  "confidence": "high" | "medium" | "low" | "unreadable",
  "reason": "brief explanation"
}`;

    try {
      const result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        agentName: "shopfloor",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: photoUrl } },
            ],
          },
        ],
        maxTokens: 1000,
        temperature: 0.1,
      });

      let validation: any;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        validation = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        validation = null;
      }

      if (!validation) {
        return new Response(
          JSON.stringify({
            valid: true,
            confidence: "unreadable",
            reason: "Could not parse AI validation response — photo accepted without verification",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasExpectedMark = !!expected_mark_number;
      let valid = true;
      if (validation.confidence === "unreadable") {
        valid = true;
      } else if (hasExpectedMark && validation.mark_match === false && validation.confidence !== "low") {
        valid = false;
      }

      return new Response(
        JSON.stringify({
          valid,
          detected_mark: validation.detected_mark || null,
          detected_drawing: validation.detected_drawing || null,
          mark_match: validation.mark_match ?? null,
          drawing_match: validation.drawing_match ?? null,
          confidence: validation.confidence || "low",
          reason: validation.reason || "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      if (e instanceof AIError) {
        return new Response(
          JSON.stringify({ valid: true, confidence: "unreadable", reason: "AI service unavailable — photo accepted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }
  }, { functionName: "validate-clearance-photo", requireCompany: false, rawResponse: true })
);
