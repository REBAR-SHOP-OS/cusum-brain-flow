import React from "react";
import { Download, Copy, FileText, Image, FileSpreadsheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return <Image className="w-4 h-4 text-blue-500 shrink-0" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />;
  if (["dwg", "dxf"].includes(ext)) return <FileText className="w-4 h-4 text-amber-600 shrink-0" />;
  return <File className="w-4 h-4 text-muted-foreground shrink-0" />;
}

function extractFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return decodeURIComponent(last || "file");
  } catch {
    return "file";
  }
}

interface Props {
  url: string;
  fileName?: string;
}

export function InlineFileLink({ url, fileName }: Props) {
  const name = fileName || extractFileName(url);

  const handleDownload = () => {
    window.open(url, "_blank");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 my-1 max-w-full">
      {getFileIcon(name)}
      <span className="text-xs font-medium truncate min-w-0 max-w-[200px]">{name}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleDownload} title="Download">
        <Download className="w-3.5 h-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleCopy} title="Copy link">
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function renderDescriptionWithFiles(text: string): React.ReactNode {
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return <InlineFileLink key={i} url={part} />;
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}
