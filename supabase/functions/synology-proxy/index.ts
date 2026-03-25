import { corsHeaders, json } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

interface QuickConnectInfo {
  baseUrl: string;
  method: string;
}

/**
 * Resolve a QuickConnect ID (e.g. "RSI1") to an actual DSM base URL
 * by querying Synology's global relay service.
 */
async function resolveQuickConnect(qcId: string): Promise<QuickConnectInfo> {
  console.log(`[QC] Resolving QuickConnect ID: ${qcId}`);

  const body = JSON.stringify({
    command: "get_server_info",
    id: qcId,
    version: 1,
  });

  const res = await fetch("https://global.quickconnect.to/Serv.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await res.json();
  console.log("[QC] Resolution response:", JSON.stringify(data).substring(0, 500));

  if (data.errno && data.errno !== 0) {
    throw new Error(`QuickConnect resolution failed: errno ${data.errno}`);
  }

  const server = data.server;
  const service = data.service;
  const env = data.env;

  // Extract HTTPS port (default 5001)
  const httpsPort = service?.port || 5001;
  const externalPort = service?.ext_port || httpsPort;

  // Build candidate URLs in priority order
  const candidates: { url: string; method: string }[] = [];

  // 1. Direct external IP
  if (server?.external?.ip) {
    candidates.push({
      url: `https://${server.external.ip}:${externalPort}`,
      method: "external_ip",
    });
  }

  // 2. DDNS hostname
  if (server?.ddns) {
    candidates.push({
      url: `https://${server.ddns}:${externalPort}`,
      method: "ddns",
    });
  }

  // 3. Synology relay tunnel
  if (env?.relay_region) {
    candidates.push({
      url: `https://${qcId}.${env.relay_region}.quickconnect.to:${externalPort}`,
      method: "relay",
    });
  }

  // 4. Fallback: try common DDNS pattern
  candidates.push({
    url: `https://${qcId}.quickconnect.to`,
    method: "quickconnect_direct",
  });

  // Try each candidate - pick the first that returns JSON from the auth API
  for (const candidate of candidates) {
    try {
      console.log(`[QC] Trying ${candidate.method}: ${candidate.url}`);
      const testUrl = `${candidate.url}/webapi/entry.cgi?api=SYNO.API.Info&version=1&method=query`;
      const testRes = await fetch(testUrl, {
        signal: AbortSignal.timeout(8000),
      });
      const text = await testRes.text();

      // Check if response is JSON (not HTML login page)
      if (text.trim().startsWith("{")) {
        console.log(`[QC] ✓ Success via ${candidate.method}: ${candidate.url}`);
        return { baseUrl: candidate.url, method: candidate.method };
      } else {
        console.log(`[QC] ✗ ${candidate.method} returned HTML, skipping`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[QC] ✗ ${candidate.method} failed: ${msg}`);
    }
  }

  throw new Error(
    `Could not resolve QuickConnect ID "${qcId}" to a reachable DSM endpoint. Tried ${candidates.length} methods.`
  );
}

/**
 * Get the base URL for the Synology DSM API.
 * Supports both direct URLs (https://...) and QuickConnect IDs (e.g. RSI1).
 */
async function getDsmBaseUrl(synologyUrl: string): Promise<string> {
  // If it already looks like a full URL with port, try it directly (with HTTP fallback)
  if (synologyUrl.match(/^https?:\/\/.+:\d+/)) {
    const directUrl = synologyUrl.replace(/\/+$/, "");
    
    // Try the URL as-is first
    try {
      const testRes = await fetch(`${directUrl}/webapi/entry.cgi?api=SYNO.API.Info&version=1&method=query`, {
        signal: AbortSignal.timeout(10000),
      });
      const text = await testRes.text();
      if (text.trim().startsWith("{")) {
        console.log(`[DSM] Direct URL works: ${directUrl}`);
        return directUrl;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[DSM] Direct URL failed (${directUrl}): ${msg}`);
    }

    // If HTTPS failed, try HTTP fallback on port 5000
    if (directUrl.startsWith("https://")) {
      const httpFallback = directUrl.replace("https://", "http://").replace(/:5001\b/, ":5000");
      try {
        const testRes = await fetch(`${httpFallback}/webapi/entry.cgi?api=SYNO.API.Info&version=1&method=query`, {
          signal: AbortSignal.timeout(10000),
        });
        const text = await testRes.text();
        if (text.trim().startsWith("{")) {
          console.log(`[DSM] HTTP fallback works: ${httpFallback}`);
          return httpFallback;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`[DSM] HTTP fallback also failed (${httpFallback}): ${msg}`);
      }
    }

    // Return original URL anyway, let caller handle the error
    console.log(`[DSM] Using original URL despite failures: ${directUrl}`);
    return directUrl;
  }

  // Extract QuickConnect ID from various formats:
  // "RSI1", "quickconnect.to/RSI1", "http://quickconnect.to/RSI1"
  let qcId = synologyUrl;
  const qcMatch = synologyUrl.match(/quickconnect\.to\/(\w+)/i);
  if (qcMatch) {
    qcId = qcMatch[1];
  }
  // Also strip any protocol prefix if someone pastes a URL without quickconnect.to
  qcId = qcId.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const resolved = await resolveQuickConnect(qcId);
  return resolved.baseUrl;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient, body } = ctx;
    const { action, path, folderPath } = body;

    const SYNOLOGY_URL_RAW = Deno.env.get("SYNOLOGY_URL") || "RSI1";
    const SYNOLOGY_USERNAME = Deno.env.get("SYNOLOGY_USERNAME");
    const SYNOLOGY_PASSWORD = Deno.env.get("SYNOLOGY_PASSWORD");

    if (!SYNOLOGY_USERNAME || !SYNOLOGY_PASSWORD) {
      return json({ error: "Synology credentials not configured" }, 400);
    }

    // Resolve the base URL (handles both direct URLs and QuickConnect IDs)
    let baseUrl: string;
    try {
      baseUrl = await getDsmBaseUrl(SYNOLOGY_URL_RAW);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to resolve NAS URL";
      console.error("DSM URL resolution error:", msg);
      return json({ error: msg }, 502);
    }

    console.log("Using DSM base URL:", baseUrl);

    // Helper: login and get sid
    async function getSid(): Promise<string> {
      const loginUrl = `${baseUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(SYNOLOGY_USERNAME!)}&passwd=${encodeURIComponent(SYNOLOGY_PASSWORD!)}&session=FileStation&format=sid`;
      console.log("Attempting DSM login to:", baseUrl);
      const res = await fetch(loginUrl);
      const text = await res.text();
      console.log("DSM login response status:", res.status, "body preview:", text.substring(0, 200));

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `DSM returned non-JSON response (status ${res.status}). The resolved URL may be incorrect or the NAS is unreachable.`
        );
      }

      if (!data.success) {
        const code = data.error?.code;
        let hint = "";
        if (code === 400) hint = " (No such account or incorrect password)";
        if (code === 401) hint = " (Account disabled)";
        if (code === 402) hint = " (Permission denied)";
        if (code === 403) hint = " (2FA required)";
        throw new Error(`DSM login failed (error code: ${code || "unknown"})${hint}`);
      }
      return data.data.sid;
    }

    // Helper: logout
    async function logout(sid: string) {
      try {
        await fetch(
          `${baseUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=1&method=logout&session=FileStation&_sid=${sid}`
        );
      } catch {
        /* ignore */
      }
    }

    if (action === "login") {
      const sid = await getSid();
      await logout(sid);
      return json({ success: true, message: "Synology NAS connection verified", resolvedUrl: baseUrl });
    }

    if (action === "list-shares") {
      const sid = await getSid();
      try {
        const url = `${baseUrl}/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list_share&_sid=${sid}`;
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
        const url = `${baseUrl}/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(folderPath)}&additional=%5B%22size%22%2C%22time%22%2C%22type%22%5D&_sid=${sid}`;
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
        const utilUrl = `${baseUrl}/webapi/entry.cgi?api=SYNO.Core.System.Utilization&version=1&method=get&_sid=${sid}`;
        const utilRes = await fetch(utilUrl);
        const utilData = await utilRes.json();

        const storageUrl = `${baseUrl}/webapi/entry.cgi?api=SYNO.Storage.CGI.Storage&version=1&method=load_info&_sid=${sid}`;
        const storageRes = await fetch(storageUrl);
        const storageData = await storageRes.json();

        const sysUrl = `${baseUrl}/webapi/entry.cgi?api=SYNO.DSM.Info&version=2&method=getinfo&_sid=${sid}`;
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
        const url = `${baseUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(path)}&mode=download&_sid=${sid}`;
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
