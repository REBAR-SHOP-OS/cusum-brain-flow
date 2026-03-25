import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/aiRouter.ts";

import { corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: accept either webhook key OR JWT
    let userId: string | null = null;
    const webhookKey = req.headers.get("x-webhook-key");
    const expectedKey = Deno.env.get("GLASSES_WEBHOOK_KEY");
    const authHeader = req.headers.get("Authorization");

    if (webhookKey && expectedKey && webhookKey === expectedKey) {
      // Webhook key auth — external device (iOS Shortcut, etc.)
    } else if (authHeader?.startsWith("Bearer ")) {
      // JWT auth — in-app usage
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, imageUrl, prompt } = await req.json();

    if (!imageBase64 && !imageUrl) {
      return new Response(JSON.stringify({ error: "imageBase64 or imageUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build image data for Gemini
    let imageData: string;
    let mimeType = "image/jpeg";

    if (imageBase64) {
      imageData = imageBase64;
      if (imageBase64.startsWith("/9j/")) mimeType = "image/jpeg";
      else if (imageBase64.startsWith("iVBOR")) mimeType = "image/png";
    } else {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
      const imgBuffer = await imgRes.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    }

    const systemPrompt = `You are Vizzy, the CEO's AI assistant for a rebar fabrication shop (CUSUM/rebar.shop).
This photo was captured from Ray-Ban Meta smart glasses on the shop floor.
Analyze what you see and provide:
- Any machine errors, damage, or safety issues
- Rebar tags, labels, or markings visible
- Production quality issues (bent angles, cut lengths, surface defects)
- Equipment status indicators
- Worker safety compliance (PPE, etc.)
Be specific and actionable. If you see a problem, suggest what to do.
If the user included a specific question, answer it directly.`;

    const userPrompt = prompt || "What do you see in this shop floor photo from my smart glasses? Any issues?";

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "vizzy",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageData}` } },
          ],
        },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    const analysis = result.content || "Could not analyze image.";

    // Store in database
    const supabase = createClient(supabaseUrl, serviceKey);

    let storedImageUrl = imageUrl || null;
    if (imageBase64 && !imageUrl) {
      const fileName = `glasses/${Date.now()}.jpg`;
      const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      const { error: uploadErr } = await supabase.storage
        .from("clearance-photos")
        .upload(fileName, bytes, { contentType: mimeType });

      if (!uploadErr) {
        const { data: urlData } = await supabase.storage
          .from("clearance-photos")
          .getPublicUrl(fileName);
        storedImageUrl = urlData?.publicUrl || null;
      }
    }

    const { error: dbErr } = await supabase.from("glasses_captures").insert({
      image_url: storedImageUrl,
      analysis,
      source: userId ? "app" : "glasses",
      prompt: prompt || null,
      metadata: { mimeType, hasBase64: !!imageBase64, hasUrl: !!imageUrl, userId },
    });

    if (dbErr) console.error("Failed to store capture:", dbErr);

    return new Response(JSON.stringify({ analysis, stored: !dbErr }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vizzy-glasses-webhook error:", err);
    const status = err instanceof AIError ? err.status : 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
