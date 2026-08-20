/**
 * Face Memory orphan photo recovery (super-admin only).
 *
 * GET  ?action=list   → list orphan profile_id folders in face-enrollments bucket,
 *                       with signed URLs for up to 6 sample photos per folder.
 * POST ?action=assign → body { orphanProfileId, targetProfileId }
 *                       Copies all photos from the orphan folder into the target's folder
 *                       and inserts active rows into face_enrollments. Then deletes orphan files.
 * POST ?action=delete → body { orphanProfileId } Removes the orphan folder permanently.
 */
import { handleRequest } from "../_shared/requestHandler.ts";
import { SUPER_ADMIN_EMAILS } from "../_shared/accessPolicies.ts";

const BUCKET = "face-enrollments";

async function assertSuperAdmin(serviceClient: any, userId: string): Promise<void> {
  const { data } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  const email = (data?.email ?? "").toLowerCase();
  if (!SUPER_ADMIN_EMAILS.includes(email)) {
    throw new Response(
      JSON.stringify({ error: "Forbidden: Super admin only" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}

Deno.serve((req) =>
  handleRequest(
    req,
    async (ctx) => {
      await assertSuperAdmin(ctx.serviceClient, ctx.userId);
      const url = new URL(ctx.req.url);
      const action = url.searchParams.get("action") ?? "list";

      if (action === "list") {
        // Get all current profile IDs
        const { data: profiles, error: pErr } = await ctx.serviceClient
          .from("profiles")
          .select("id");
        if (pErr) throw new Error(pErr.message);
        const validIds = new Set((profiles ?? []).map((p: any) => p.id as string));

        // List top-level folders in the bucket
        const { data: topLevel, error: lErr } = await ctx.serviceClient
          .storage
          .from(BUCKET)
          .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
        if (lErr) throw new Error(lErr.message);

        const folders = (topLevel ?? []).filter((o: any) => o.id === null || !o.metadata);
        const orphans: Array<{
          profileId: string;
          photoCount: number;
          lastUpload: string | null;
          samples: Array<{ path: string; url: string; createdAt: string | null }>;
        }> = [];

        for (const folder of folders) {
          const folderName = folder.name as string;
          if (validIds.has(folderName)) continue;

          const { data: files } = await ctx.serviceClient
            .storage
            .from(BUCKET)
            .list(folderName, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

          const photoFiles = (files ?? []).filter((f: any) => f.name && !f.name.startsWith("."));
          if (photoFiles.length === 0) continue;

          const samples: Array<{ path: string; url: string; createdAt: string | null }> = [];
          for (const f of photoFiles.slice(0, 6)) {
            const fullPath = `${folderName}/${f.name}`;
            const { data: signed } = await ctx.serviceClient
              .storage
              .from(BUCKET)
              .createSignedUrl(fullPath, 600);
            if (signed?.signedUrl) {
              samples.push({
                path: fullPath,
                url: signed.signedUrl,
                createdAt: f.created_at ?? null,
              });
            }
          }

          orphans.push({
            profileId: folderName,
            photoCount: photoFiles.length,
            lastUpload: photoFiles[0]?.created_at ?? null,
            samples,
          });
        }

        orphans.sort((a, b) => (b.lastUpload ?? "").localeCompare(a.lastUpload ?? ""));
        return { orphans };
      }

      if (action === "assign") {
        const orphanProfileId = String(ctx.body.orphanProfileId ?? "");
        const targetProfileId = String(ctx.body.targetProfileId ?? "");
        if (!orphanProfileId || !targetProfileId) {
          throw new Error("orphanProfileId and targetProfileId are required");
        }

        // Verify target exists
        const { data: target, error: tErr } = await ctx.serviceClient
          .from("profiles")
          .select("id, full_name")
          .eq("id", targetProfileId)
          .maybeSingle();
        if (tErr || !target) throw new Error("Target profile not found");

        // List orphan files
        const { data: files, error: fErr } = await ctx.serviceClient
          .storage
          .from(BUCKET)
          .list(orphanProfileId, { limit: 100 });
        if (fErr) throw new Error(fErr.message);

        const photoFiles = (files ?? []).filter((f: any) => f.name && !f.name.startsWith("."));
        if (photoFiles.length === 0) throw new Error("No photos in orphan folder");

        const ts = Date.now();
        const newPaths: string[] = [];

        for (let i = 0; i < photoFiles.length; i++) {
          const f = photoFiles[i];
          const sourcePath = `${orphanProfileId}/${f.name}`;
          const newPath = `${targetProfileId}/recovered-${ts}-${i}.jpg`;

          // Copy file
          const { error: copyErr } = await ctx.serviceClient
            .storage
            .from(BUCKET)
            .copy(sourcePath, newPath);
          if (copyErr) {
            ctx.log.warn(`copy failed for ${sourcePath}`, { error: copyErr.message });
            continue;
          }
          newPaths.push(newPath);
        }

        if (newPaths.length === 0) throw new Error("No files could be copied");

        // Insert face_enrollments rows
        const rows = newPaths.map((p) => ({
          profile_id: targetProfileId,
          photo_url: p,
          is_active: true,
        }));
        const { error: insErr } = await ctx.serviceClient
          .from("face_enrollments")
          .insert(rows);
        if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

        // Delete original orphan files
        const toDelete = photoFiles.map((f: any) => `${orphanProfileId}/${f.name}`);
        await ctx.serviceClient.storage.from(BUCKET).remove(toDelete);

        return {
          assigned: newPaths.length,
          targetName: target.full_name,
        };
      }

      if (action === "delete") {
        const orphanProfileId = String(ctx.body.orphanProfileId ?? "");
        if (!orphanProfileId) throw new Error("orphanProfileId is required");

        const { data: files } = await ctx.serviceClient
          .storage
          .from(BUCKET)
          .list(orphanProfileId, { limit: 100 });
        const toDelete = (files ?? [])
          .filter((f: any) => f.name && !f.name.startsWith("."))
          .map((f: any) => `${orphanProfileId}/${f.name}`);
        if (toDelete.length > 0) {
          await ctx.serviceClient.storage.from(BUCKET).remove(toDelete);
        }
        return { deleted: toDelete.length };
      }

      throw new Error(`Unknown action: ${action}`);
    },
    {
      functionName: "face-recover-orphans",
      requireCompany: false,
      authMode: "required",
    },
  )
);
