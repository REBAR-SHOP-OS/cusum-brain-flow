import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);
    const { action, path, folderPath } = await req.json();

    const SYNOLOGY_URL = Deno.env.get("SYNOLOGY_URL") || "https://RSIC.synology.me:5001";
    const SYNOLOGY_USERNAME = Deno.env.get("SYNOLOGY_USERNAME");
    const SYNOLOGY_PASSWORD = Deno.env.get("SYNOLOGY_PASSWORD");

    if (!SYNOLOGY_USERNAME || !SYNOLOGY_PASSWORD) {
      return json({ error: "Synology credentials not configured" }, 400);
    }

    // Helper: login and get sid
    async function getSid(): Promise<string> {
      const loginUrl = `${SYNOLOGY_URL}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(SYNOLOGY_USERNAME!)}&passwd=${encodeURIComponent(SYNOLOGY_PASSWORD!)}&session=FileStation&format=sid`;
      const res = await fetch(loginUrl, {
        // Skip SSL verification for self-signed certs common on NAS
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(`DSM login failed (error code: ${data.error?.code || "unknown"})`);
      }
      return data.data.sid;
    }

    // Helper: logout
    async function logout(sid: string) {
      try {
        await fetch(`${SYNOLOGY_URL}/webapi/auth.cgi?api=SYNO.API.Auth&version=1&method=logout&session=FileStation&_sid=${sid}`);
      } catch { /* ignore */ }
    }

    if (action === "login") {
      // Test connection
      const sid = await getSid();
      await logout(sid);
      return json({ success: true, message: "Synology NAS connection verified" });
    }

    if (action === "list-shares") {
      const sid = await getSid();
      try {
        const url = `${SYNOLOGY_URL}/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list_share&_sid=${sid}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error("Failed to list shares");
        return json({ shares: data.data.shares });
      } finally {
        await logout(sid);
      }
    }

    if (action === "list-files") {
      if (!folderPath) return json({ error: "folderPath required" }, 400);
      const sid = await getSid();
      try {
        const url = `${SYNOLOGY_URL}/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(folderPath)}&additional=%5B%22size%22%2C%22time%22%2C%22type%22%5D&_sid=${sid}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error(`Failed to list files in ${folderPath}`);
        return json({ files: data.data.files, total: data.data.total, offset: data.data.offset });
      } finally {
        await logout(sid);
      }
    }

    if (action === "system-info") {
      const sid = await getSid();
      try {
        // Get system utilization
        const utilUrl = `${SYNOLOGY_URL}/webapi/entry.cgi?api=SYNO.Core.System.Utilization&version=1&method=get&_sid=${sid}`;
        const utilRes = await fetch(utilUrl);
        const utilData = await utilRes.json();

        // Get storage info
        const storageUrl = `${SYNOLOGY_URL}/webapi/entry.cgi?api=SYNO.Storage.CGI.Storage&version=1&method=load_info&_sid=${sid}`;
        const storageRes = await fetch(storageUrl);
        const storageData = await storageRes.json();

        // Get system info
        const sysUrl = `${SYNOLOGY_URL}/webapi/entry.cgi?api=SYNO.DSM.Info&version=2&method=getinfo&_sid=${sid}`;
        const sysRes = await fetch(sysUrl);
        const sysData = await sysRes.json();

        return json({
          utilization: utilData.success ? utilData.data : null,
          storage: storageData.success ? storageData.data : null,
          system: sysData.success ? sysData.data : null,
        });
      } finally {
        await logout(sid);
      }
    }

    if (action === "download") {
      if (!path) return json({ error: "path required" }, 400);
      const sid = await getSid();
      try {
        const url = `${SYNOLOGY_URL}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(path)}&mode=download&_sid=${sid}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const fileName = path.split("/").pop() || "download";
        await logout(sid);
        return new Response(blob, {
          headers: {
            ...corsHeaders,
            "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${fileName}"`,
          },
        });
      } catch (e) {
        await logout(sid);
        throw e;
      }
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("synology-proxy error:", msg);
    return json({ error: msg }, 500);
  }
});
