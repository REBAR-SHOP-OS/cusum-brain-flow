import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Upload, X, FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  entityType: "Invoice" | "Bill" | "Purchase" | "VendorCredit" | "Estimate";
  entityId: string;
  className?: string;
}

interface Attachment {
  Id: string;
  FileName?: string;
  Size?: number;
  ContentType?: string;
}

export function QBAttachmentUploader({ entityType, entityId, className }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadAttachments = async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "list-attachments", entityType, entityId },
      });
      if (error) throw error;
      setAttachments(data?.attachments || []);
    } catch (e: any) {
      toast({ title: "Failed to load attachments", description: e.message, variant: "destructive" });
    } finally {
      setLoadingList(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) loadAttachments();
    setExpanded(!expanded);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: {
          action: "upload-attachment",
          entityType,
          entityId,
          fileName: file.name,
          contentType: file.type,
          base64Content: base64,
        },
      });
      if (error) throw error;
      toast({ title: "Attachment uploaded" });
      loadAttachments();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1 text-xs"
        onClick={handleToggle}
      >
        <Paperclip className="w-3.5 h-3.5" />
        Attachments {attachments.length > 0 && `(${attachments.length})`}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-2 p-3 border border-border rounded-lg bg-muted/30">
          {loadingList ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading...
            </div>
          ) : attachments.length > 0 ? (
            <div className="space-y-1">
              {attachments.map((a) => (
                <div key={a.Id} className="flex items-center gap-2 text-xs">
                  <FileIcon className="w-3 h-3 text-muted-foreground" />
                  <span className="truncate">{a.FileName || "Untitled"}</span>
                  <span className="text-muted-foreground">{formatSize(a.Size)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No attachments</p>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-xs h-7"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? "Uploading..." : "Upload file"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
