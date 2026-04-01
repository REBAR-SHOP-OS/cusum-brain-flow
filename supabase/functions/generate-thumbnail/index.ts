import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient, body }) => {
    const { prompt, projectId } = body;
    if (!prompt || !projectId) {
      return new Response(JSON.stringify({ error: "prompt and projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate thumbnail image using AI
    const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Generate a high-quality, cinematic 16:9 thumbnail image for this video ad concept. Photorealistic, dramatic lighting, professional composition. Concept: ${prompt.substring(0, 500)}`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!imgResp.ok) {
      const errText = await imgResp.text();
      console.error("AI image generation failed:", imgResp.status, errText);

      if (imgResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (imgResp.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Failed to generate thumbnail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imgData = await imgResp.json();
    const b64Url = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!b64Url) {
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to storage
    const base64Data = b64Url.replace(/^data:image\/\w+;base64,/, "");
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

    const fileName = `thumbnails/${userId}/${projectId}.png`;
    const { error: uploadErr } = await serviceClient.storage
      .from("ad-assets")
      .upload(fileName, bytes, { contentType: "image/png", upsert: true });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(JSON.stringify({ error: "Failed to upload thumbnail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = serviceClient.storage.from("ad-assets").getPublicUrl(fileName);
    const thumbnailUrl = urlData?.publicUrl;

    // Update the project with the thumbnail URL
    const { error: updateErr } = await serviceClient
      .from("ad_projects")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", projectId)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("DB update error:", updateErr);
    }

    return { thumbnailUrl };
  }, { functionName: "generate-thumbnail", requireCompany: false })
);
