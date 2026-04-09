import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: supabase, body }) => {
    const faceSchema = z.object({
      capturedImageBase64: z.string().min(100).max(10_000_000, "Image too large (max ~7.5MB)"),
      companyId: z.string().uuid().optional(),
    });
    const parsed = faceSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation failed:", parsed.error.flatten().fieldErrors);
      return new Response(JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const { capturedImageBase64, companyId } = parsed.data;

    // Fetch active face enrollments, filtered by company if provided
    let enrollQuery = supabase
      .from("face_enrollments")
      .select("id, profile_id, photo_url")
      .eq("is_active", true);

    if (companyId) {
      // Get profile IDs for this company first
      const { data: companyProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", companyId);
      if (companyProfiles && companyProfiles.length > 0) {
        enrollQuery = enrollQuery.in("profile_id", companyProfiles.map(p => p.id));
      }
    }

    const { data: enrollments, error: enrollErr } = await enrollQuery;

    if (enrollErr) {
      console.error("Error fetching enrollments:", enrollErr);
      return new Response(JSON.stringify({ error: "Failed to fetch enrollments" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    if (!enrollments || enrollments.length === 0) {
      return { matched: false, reason: "No enrolled faces found" };
    }

    // Group enrollments by profile_id, limit to 1 per person for speed
    const profileEnrollments = new Map<string, string[]>();
    const profileEnrollmentCounts = new Map<string, number>();
    for (const e of enrollments) {
      profileEnrollmentCounts.set(e.profile_id, (profileEnrollmentCounts.get(e.profile_id) || 0) + 1);
      const urls = profileEnrollments.get(e.profile_id) || [];
      if (urls.length < 3) {
        urls.push(e.photo_url);
        profileEnrollments.set(e.profile_id, urls);
      }
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

    // Download reference photos and convert to base64 data URLs (avoids Gemini URL fetch failures)
    const enrolledFaces: { profile_id: string; name: string; photo_urls: string[] }[] = [];

    // Download all photos in parallel for speed
    const downloadPhoto = async (url: string): Promise<string | null> => {
      try {
        const storagePath = url.replace(/^.*face-enrollments\//, "");
        const { data: fileData, error: dlErr } = await supabase.storage
          .from("face-enrollments")
          .download(storagePath);
        if (dlErr || !fileData) {
          console.warn(`[face-recognize] Failed to download ${storagePath}:`, dlErr);
          return null;
        }
        const arrayBuf = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        // Convert to base64 in chunks to avoid stack overflow
        const chunks: string[] = [];
        for (let i = 0; i < bytes.length; i += 8192) {
          chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
        }
        const b64 = btoa(chunks.join(""));
        return `data:image/jpeg;base64,${b64}`;
      } catch (e) {
        console.warn(`[face-recognize] Error converting photo to base64:`, e);
        return null;
      }
    };

    // Build download tasks for all profiles in parallel
    const profileEntries = Array.from(profileEnrollments.entries());
    const downloadResults = await Promise.all(
      profileEntries.map(async ([profileId, photoUrls]) => {
        const results = await Promise.all(photoUrls.map(downloadPhoto));
        return { profileId, base64Urls: results.filter((r): r is string => r !== null) };
      })
    );

    for (const { profileId, base64Urls } of downloadResults) {
      if (base64Urls.length > 0) {
        const info = profileMap.get(profileId);
        enrolledFaces.push({
          profile_id: profileId,
          name: info?.name || "Unknown",
          photo_urls: base64Urls,
        });
      }
    }

    if (enrolledFaces.length === 0) {
      return { matched: false, reason: "No valid enrollment photos found" };
    }

    // Build the prompt for AI vision
    const employeeList = enrolledFaces
      .map((e, i) => `Employee ${i + 1}: profile_id="${e.profile_id}", name="${e.name}"`)
      .join("\n");

    const contentParts: any[] = [
      {
        type: "text",
        text: `Facial recognition system. Compare the CAPTURED photo against ALL enrolled reference photos below.

Enrolled employees:
${employeeList}

Each employee may have multiple reference photos taken from different angles and lighting conditions. Use ALL provided reference photos to build a complete understanding of each person's facial features.

Rules:
- Match ONLY on facial features: bone structure, nose shape, eye shape/spacing, jawline, facial hair, glasses, face shape, skin tone.
- Cross-reference ALL reference photos for each person — if the captured face matches consistently across multiple references, increase confidence.
- Account for variations in lighting, angle, expression, and camera quality between the captured photo and references.
- Confidence 85+: highly certain match. 60-84: likely resemblance. Below 50: no match (set matched_profile_id="null").
- Multiple faces in captured photo → identify the center/largest face only.
- When uncertain, prefer "no match" over a wrong match.

Call face_match_result with your answer.`,
      },
    ];

    // Add enrolled reference photos
    for (const face of enrolledFaces) {
      contentParts.push({ type: "text", text: `\n--- Reference photos for ${face.name} (${face.profile_id}) ---` });
      for (const url of face.photo_urls) {
        contentParts.push({ type: "image_url", image_url: { url } });
      }
    }

    // Add captured photo
    contentParts.push({ type: "text", text: "\n--- CAPTURED PHOTO TO IDENTIFY ---" });
    contentParts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${capturedImageBase64}` } });

    const toolDef = {
      type: "function" as const,
      function: {
        name: "face_match_result",
        description: "Return the result of facial recognition matching.",
        parameters: {
          type: "object",
          properties: {
            matched_profile_id: { type: "string", description: "The profile_id of the matched person, or 'null' if no match." },
            matched_name: { type: "string", description: "The name of the matched person, or 'Unknown'." },
            confidence: { type: "number", description: "Confidence score from 0-100." },
            reason: { type: "string", description: "Brief explanation of the match or non-match." },
          },
          required: ["matched_profile_id", "matched_name", "confidence", "reason"],
          additionalProperties: false,
        },
      },
    };

    // Call AI with vision
    let aiResult;
    try {
      console.log(`[face-recognize] Calling AI with ${enrolledFaces.length} enrolled faces`);
      aiResult = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        agentName: "shopfloor",
        messages: [{ role: "user", content: contentParts }],
        tools: [toolDef],
        toolChoice: { type: "function", function: { name: "face_match_result" } },
      });
      console.log(`[face-recognize] AI response: toolCalls=${aiResult.toolCalls?.length}, content=${aiResult.content?.slice(0, 200)}`);
    } catch (aiErr) {
      if (aiErr instanceof AIError) {
        console.error("[face-recognize] AI error:", aiErr.status, aiErr.message);
        return { matched: false, reason: `Recognition unavailable: ${aiErr.message}` };
      }
      console.error("[face-recognize] AI error:", aiErr);
      return { matched: false, reason: "Recognition unavailable, please register manually" };
    }

    // Try to extract result from tool calls first, then fallback to text parsing
    let resultData: any = null;

    const toolCall = aiResult.toolCalls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        resultData = JSON.parse(toolCall.function.arguments);
        console.log("[face-recognize] Parsed from tool call:", resultData);
      } catch (e) {
        console.error("[face-recognize] Failed to parse tool call arguments:", e);
      }
    }

    // Fallback: parse from text content
    if (!resultData && aiResult.content) {
      console.log("[face-recognize] No tool call, attempting text parse...");
      try {
        const jsonMatch = aiResult.content.match(/\{[\s\S]*?"matched_profile_id"[\s\S]*?\}/);
        if (jsonMatch) {
          resultData = JSON.parse(jsonMatch[0]);
          console.log("[face-recognize] Parsed from text fallback:", resultData);
        }
      } catch (e) {
        console.error("[face-recognize] Text parse failed:", e);
      }
    }

    if (!resultData) {
      console.error("[face-recognize] No structured result. Raw:", aiResult.content?.slice(0, 500));
      return { matched: false, reason: "AI returned no structured result" };
    }

    const isMatched =
      resultData.matched_profile_id &&
      resultData.matched_profile_id !== "null" &&
      resultData.confidence >= 60;

    const matchedProfile = isMatched ? profileMap.get(resultData.matched_profile_id) : null;
    const enrollCount = isMatched ? (profileEnrollmentCounts.get(resultData.matched_profile_id) || 0) : 0;

    return {
      matched: isMatched,
      profile_id: isMatched ? resultData.matched_profile_id : null,
      name: isMatched ? resultData.matched_name : null,
      confidence: resultData.confidence,
      reason: resultData.reason,
      avatar_url: matchedProfile?.avatar || null,
      enrollment_count: enrollCount,
    };
  }, { functionName: "face-recognize", requireCompany: false, wrapResult: false })
);
