import { toast } from "sonner";

/**
 * Programmatically download a file by fetching it as a blob.
 * This bypasses the cross-origin restriction on the `download` attribute.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    toast.error("دانلود فایل با خطا مواجه شد");
  }
}
