import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, Trash2, Download, Loader2, FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "@/hooks/use-toast";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  uploaded_by: string | null;
}

interface Props {
  entityType: "quote" | "invoice" | "order" | "sales_quotation";
  entityId: string;
  readOnly?: boolean;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export function DocumentAttachments({ entityType, entityId, readOnly }: Props) {
  const { companyId } = useCompanyId();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("document_attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (!error) setAttachments((data as any[]) || []);
    setLoading(false);
  }, [entityType, entityId, companyId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !companyId) return;
    setUploading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      for (const file of Array.from(files)) {
        const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const storagePath = `${user?.id || "anon"}/${entityType}/${entityId}/${safeName}`;

        const { error: upErr } = await uploadToStorage(
          "document-attachments",
          storagePath,
          file,
          { contentType: file.type, upsert: false }
        );
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("document_attachments").insert({
          company_id: companyId,
          entity_type: entityType,
          entity_id: entityId,
          file_name: file.name,
          file_path: storagePath,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: user?.id || null,
        } as any);
        if (dbErr) throw dbErr;
      }
      toast({ title: "Files uploaded" });
      load();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (att: Attachment) => {
    const { data } = await supabase.storage
      .from("document-attachments")
      .createSignedUrl(att.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast({ title: "Could not generate download link", variant: "destructive" });
  };

  const handleDelete = async (att: Attachment) => {
    if (!window.confirm(`Delete "${att.file_name}"?`)) return;
    await supabase.storage.from("document-attachments").remove([att.file_path]);
    await supabase.from("document_attachments").delete().eq("id", att.id);
    toast({ title: "Attachment deleted" });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading attachments…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Paperclip className="w-4 h-4" />
          Attachments
          {attachments.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">{attachments.length}</Badge>
          )}
        </h4>
        {!readOnly && (
          <label className="cursor-pointer">
            <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload
              </span>
            </Button>
          </label>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No attachments yet.</p>
      ) : (
        <div className="space-y-1">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 group text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{att.file_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(att.file_size)}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(att)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                {!readOnly && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(att)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
