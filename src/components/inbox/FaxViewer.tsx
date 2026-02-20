import { FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Communication } from "@/hooks/useCommunications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface FaxViewerProps {
  communication: Communication;
}

export function FaxViewer({ communication }: FaxViewerProps) {
  const meta = communication.metadata as Record<string, unknown> | null;
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const attachments = (meta?.attachments as Array<{ id: string; uri: string; type: string; name?: string }>) || [];
  const pageCount = (meta?.page_count as number) || 0;
  const faxResolution = (meta?.resolution as string) || "Standard";

  const handleDownload = async (attachmentUri: string, name?: string) => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ringcentral-recording", {
        body: { contentUri: attachmentUri, download: true },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-purple-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Fax Document</p>
          <p className="text-xs text-muted-foreground">
            {pageCount > 0 ? `${pageCount} page(s)` : "Unknown pages"} · {faxResolution}
          </p>
        </div>
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((att, i) => (
            <div key={att.id || i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm flex-1 truncate">{att.name || `Attachment ${i + 1}`}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(att.uri, att.name)}
                disabled={downloading}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground p-2">No attachments available</p>
      )}
    </div>
  );
}
