import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard — caller must be authenticated
    let _userId: string;
    try {
      const auth = await requireAuth(req);
      _userId = auth.userId;
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const faceSchema = z.object({
      capturedImageBase64: z.string().min(100).max(10_000_000, "Image too large (max ~7.5MB)"),
      companyId: z.string().uuid().optional(),
    });
    const parsed = faceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { capturedImageBase64, companyId } = parsed.data;

    // AI keys loaded via aiRouter

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active face enrollments with profile info
    const { data: enrollments, error: enrollErr } = await supabase
      .from("face_enrollments")
      .select("id, profile_id, photo_url")
      .eq("is_active", true);

    if (enrollErr) {
      console.error("Error fetching enrollments:", enrollErr);
      return new Response(JSON.stringify({ error: "Failed to fetch enrollments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ matched: false, reason: "No enrolled faces found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group enrollments by profile_id
    const profileEnrollments = new Map<string, string[]>();
    for (const e of enrollments) {
      const urls = profileEnrollments.get(e.profile_id) || [];
      urls.push(e.photo_url);
      profileEnrollments.set(e.profile_id, urls);
    }

    // Fetch profile names
    const profileIds = Array.from(profileEnrollments.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", profileIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, { name: p.full_name, avatar: p.avatar_url }])
    );

    // Generate signed URLs for enrolled photos
    const enrolledFaces: { profile_id: string; name: string; photo_urls: string[] }[] = [];

    for (const [profileId, photoUrls] of profileEnrollments.entries()) {
      const signedUrls: string[] = [];
      for (const url of photoUrls.slice(0, 3)) {
        // Extract storage path from the photo_url
        const storagePath = url.replace(/^.*face-enrollments\//, "");
        const { data: signedData } = await supabase.storage
          .from("face-enrollments")
          .createSignedUrl(storagePath, 300);
        if (signedData?.signedUrl) {
          signedUrls.push(signedData.signedUrl);
        }
      }
      if (signedUrls.length > 0) {
        const info = profileMap.get(profileId);
        enrolledFaces.push({
          profile_id: profileId,
          name: info?.name || "Unknown",
          photo_urls: signedUrls,
        });
      }
    }

    if (enrolledFaces.length === 0) {
      return new Response(
        JSON.stringify({ matched: false, reason: "No valid enrollment photos found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt for AI vision
    const employeeList = enrolledFaces
      .map((e, i) => `Employee ${i + 1}: profile_id="${e.profile_id}", name="${e.name}"`)
      .join("\n");

    const contentParts: any[] = [
      {
        type: "text",
        text: `You are a facial recognition system. Compare the CAPTURED photo against the enrolled employee reference photos below.

Enrolled employees:
${employeeList}

For each employee, I'm providing their reference photos followed by the captured photo to match.

RULES:
- Return the profile_id and name of the matching person
- Return a confidence score from 0 to 100
- If no match is found, return null for profile_id
- Be strict: only match if you are genuinely confident the person is the same
- Consider lighting, angle, and expression variations`,
      },
    ];

    // Add enrolled reference photos
    for (const face of enrolledFaces) {
      contentParts.push({
        type: "text",
        text: `\n--- Reference photos for ${face.name} (${face.profile_id}) ---`,
      });
      for (const url of face.photo_urls) {
        contentParts.push({
          type: "image_url",
          image_url: { url },
        });
      }
    }

    // Add captured photo
    contentParts.push({
      type: "text",
      text: "\n--- CAPTURED PHOTO TO IDENTIFY ---",
    });
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${capturedImageBase64}`,
      },
    });

    // Call AI with vision + tool calling for structured output
    let aiResult;
    try {
      aiResult = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "face_match_result",
              description:
                "Return the result of facial recognition matching.",
              parameters: {
                type: "object",
                properties: {
                  matched_profile_id: {
                    type: "string",
                    description:
                      "The profile_id of the matched person, or 'null' if no match.",
                  },
                  matched_name: {
                    type: "string",
                    description: "The name of the matched person, or 'Unknown'.",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score from 0-100.",
                  },
                  reason: {
                    type: "string",
                    description: "Brief explanation of the match or non-match.",
                  },
                },
                required: [
                  "matched_profile_id",
                  "matched_name",
                  "confidence",
                  "reason",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        toolChoice: {
          type: "function",
          function: { name: "face_match_result" },
        },
      });
    } catch (aiErr) {
      if (aiErr instanceof AIError) {
        return new Response(JSON.stringify({ error: aiErr.message }), {
          status: aiErr.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", aiErr);
      return new Response(JSON.stringify({ error: "AI recognition failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolCall = aiResult.toolCalls[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({ matched: false, reason: "AI returned no structured result" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultData = JSON.parse(toolCall.function.arguments);
    const isMatched =
      resultData.matched_profile_id &&
      resultData.matched_profile_id !== "null" &&
      resultData.confidence >= 50;

    const matchedProfile = isMatched
      ? profileMap.get(resultData.matched_profile_id)
      : null;

    return new Response(
      JSON.stringify({
        matched: isMatched,
        profile_id: isMatched ? resultData.matched_profile_id : null,
        name: isMatched ? resultData.matched_name : null,
        confidence: resultData.confidence,
        reason: resultData.reason,
        avatar_url: matchedProfile?.avatar || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("face-recognize error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
