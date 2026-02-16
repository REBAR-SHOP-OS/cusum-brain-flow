import { BlobReader, ZipReader, BlobWriter } from "@zip.js/zip.js";
import { supabase } from "@/integrations/supabase/client";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf",
    html: "text/html", css: "text/css", js: "text/javascript",
    php: "text/x-php", json: "application/json", xml: "application/xml",
    txt: "text/plain", md: "text/markdown",
  };
  return map[ext] || "application/octet-stream";
}

function isImage(name: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(name);
}

export interface ZipAnalysisResult {
  summary: string;
  imageUrls: string[];
}

export async function analyzeZip(file: File): Promise<ZipAnalysisResult> {
  const reader = new ZipReader(new BlobReader(file));
  const entries = await reader.getEntries();

  let totalSize = 0;
  const lines: string[] = [];
  const imageEntries: typeof entries = [];

  for (const entry of entries) {
    const size = entry.uncompressedSize || 0;
    totalSize += size;
    const name = entry.filename;
    if (entry.directory) {
      lines.push(`- ${name}`);
    } else {
      lines.push(`- ${name} (${formatSize(size)})`);
      if (isImage(name) && imageEntries.length < 3 && size < 5 * 1024 * 1024) {
        imageEntries.push(entry);
      }
    }
  }

  const fileCount = entries.filter((e) => !e.directory).length;
  const summary = [
    `[ZIP Analysis: ${file.name}]`,
    `Total files: ${fileCount} | Total size: ${formatSize(totalSize)}`,
    "",
    "Directory structure:",
    ...lines.slice(0, 100),
    lines.length > 100 ? `... and ${lines.length - 100} more entries` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Extract and upload up to 3 images
  const imageUrls: string[] = [];
  for (const imgEntry of imageEntries) {
    try {
      if (!("getData" in imgEntry) || typeof (imgEntry as any).getData !== "function") continue;
      const blob = await (imgEntry as any).getData(new BlobWriter(getMimeType(imgEntry.filename)));
      const path = `chat-uploads/${Date.now()}-${imgEntry.filename.split("/").pop()}`;
      const { error } = await supabase.storage.from("clearance-photos").upload(path, blob);
      if (error) continue;
      const { data: urlData } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 3600);
      if (urlData?.signedUrl) imageUrls.push(urlData.signedUrl);
    } catch {
      // skip failed extractions
    }
  }

  await reader.close();
  return { summary, imageUrls };
}
