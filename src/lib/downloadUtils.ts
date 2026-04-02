import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const isDev = import.meta.env.DEV;

/**
 * Programmatically download a file by fetching it as a blob.
 * Falls back to edge-function proxy if direct fetch fails (CORS).
 * Final fallback: open in new tab.
 */
export async function downloadFile(
  url: string,
  filename: string,
  proxyOptions?: { provider?: "wan" | "veo" | "sora"; jobId?: string },
): Promise<void> {
  // data: URIs can always be fetched directly
  if (url.startsWith("data:")) {
    return directDownload(url, filename);
  }

  // Supabase storage URLs: use anchor tag to bypass CORS fetch issues
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  if (supabaseUrl && url.includes(supabaseUrl)) {
    if (isDev) console.log("[download] Supabase storage URL detected, using anchor download");
    triggerAnchorDownload(url, filename);
    return;
  }

  // 1) Try direct fetch
  try {
    if (isDev) console.log("[download] Attempting direct fetch:", url.slice(0, 80));
    await directDownload(url, filename);
    if (isDev) console.log("[download] Direct fetch succeeded");
    return;
  } catch (e) {
    if (isDev) console.warn("[download] Direct fetch failed, trying proxy:", (e as Error).message);
  }

  // 2) Try proxy via generate-video edge function
  if (proxyOptions?.provider) {
    try {
      if (isDev) console.log("[download] Attempting proxy download via", proxyOptions.provider);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`;
      const resp = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "download",
          provider: proxyOptions.provider,
          videoUrl: url,
          jobId: proxyOptions.jobId,
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "unknown");
        throw new Error(`Proxy returned ${resp.status}: ${errorText}`);
      }

      const blob = await resp.blob();
      if (blob.size === 0) throw new Error("Proxy returned empty blob");

      triggerBlobDownload(blob, filename);
      if (isDev) console.log("[download] Proxy download succeeded, size:", blob.size);
      return;
    } catch (e) {
      if (isDev) console.warn("[download] Proxy download failed:", (e as Error).message);
    }
  }

  // 3) Final fallback: open in new tab
  if (isDev) console.log("[download] Falling back to new tab");
  window.open(url, "_blank");
  toast.info("فایل در تب جدید باز شد — برای ذخیره، کلیک راست کرده و Save As را بزنید");
}

async function directDownload(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const blob = await response.blob();
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

function triggerAnchorDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
