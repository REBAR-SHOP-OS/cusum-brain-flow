import { Paperclip, Download, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface LeadFilesProps {
  metadata: Json | null;
  leadId?: string;
}

interface FileAttachment {
  filename: string;
  mimeType?: string;
  size?: number;
  storagePath?: string;
}

interface FileLink {
  url: string;
  domain?: string;
}

function parseMetadata(metadata: Json | null): { attachments: FileAttachment[]; links: FileLink[] } {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { attachments: [], links: [] };
  }
  const m = metadata as Record<string, Json | undefined>;
  const attachments = Array.isArray(m.attachments) ? (m.attachments as unknown as FileAttachment[]) : [];
  const links = Array.isArray(m.file_links) ? (m.file_links as unknown as FileLink[]) : [];
  return { attachments, links };
}

function formatSize(bytes: number | undefined | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType?: string | null) {
  if (mimeType?.includes("pdf")) return "📄";
  if (mimeType?.includes("image")) return "🖼️";
  if (mimeType?.includes("dwg") || mimeType?.includes("autocad")) return "📐";
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) return "📊";
  return "📎";
}

export function LeadFiles({ metadata, leadId }: LeadFilesProps) {
  const { attachments, links } = parseMetadata(metadata);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Fetch Odoo-synced files from lead_files table
  const { data: dbFiles = [] } = useQuery({
    queryKey: ["lead-files", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from("lead_files")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  const handleDownload = async (att: FileAttachment) => {
    if (!att.storagePath) return;
    setDownloading(att.filename);
    try {
      const url = await getSignedFileUrl(att.storagePath);
      if (url) window.open(url, "_blank");
    } finally {
      setDownloading(null);
    }
  };

  const totalFiles = attachments.length + links.length + dbFiles.length;

  if (totalFiles === 0) {
    return (
      <div className="text-center py-8">
        <Paperclip className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">No files or links attached.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Odoo-synced files */}
      {dbFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Paperclip className="w-3 h-3" />
            Odoo Files ({dbFiles.length})
          </h4>
          <div className="space-y-1.5">
            {dbFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{fileIcon(file.mime_type)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {file.mime_type && <span>{file.mime_type.split("/").pop()}</span>}
                      {file.file_size_bytes && <span>{formatSize(file.file_size_bytes)}</span>}
                    </div>
                  </div>
                </div>
                {file.file_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 gap-1"
                    onClick={() => window.open(file.file_url!, "_blank")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email attachments from metadata */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Paperclip className="w-3 h-3" />
            Email Attachments ({attachments.length})
          </h4>
          <div className="space-y-1.5">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{fileIcon(att.mimeType)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{att.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {att.mimeType && <span>{att.mimeType.split("/").pop()}</span>}
                      {att.size && <span>{formatSize(att.size)}</span>}
                    </div>
                  </div>
                </div>
                {att.storagePath && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 gap-1"
                    disabled={downloading === att.filename}
                    onClick={() => handleDownload(att)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Link2 className="w-3 h-3" />
            Linked Files ({links.length})
          </h4>
          <div className="space-y-1.5">
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
              >
                <Link2 className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-primary">{link.url}</p>
                  {link.domain && (
                    <Badge variant="secondary" className="text-xs mt-0.5">{link.domain}</Badge>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
