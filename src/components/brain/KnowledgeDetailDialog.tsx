import { useState } from "react";
import { X, Loader2, Trash2, Paperclip, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string | null;
  category: string;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface KnowledgeDetailDialogProps {
  item: KnowledgeItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function KnowledgeDetailDialog({ item, onClose, onUpdated }: KnowledgeDetailDialogProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item?.title || "");
  const [content, setContent] = useState(item?.content || "");
  const [sourceUrl, setSourceUrl] = useState(item?.source_url || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("knowledge")
        .update({
          title: title.trim(),
          content: content.trim() || null,
          source_url: sourceUrl.trim() || null,
        })
        .eq("id", item.id);

      if (error) throw error;
      toast({ title: "Updated!" });
      setEditing(false);
      onUpdated();
    } catch (err) {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("knowledge").delete().eq("id", item.id);
      if (error) throw error;
      toast({ title: "Deleted" });
      onClose();
      onUpdated();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const formattedDate = new Date(item.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] bg-card rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <span className="text-xs text-muted-foreground capitalize">{item.category} • {formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                />
              </div>
              {["image", "video", "webpage", "document"].includes(item.category) && (
                <div className="space-y-2">
                  <Label>Source URL</Label>
                  <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">{item.title}</h2>

              {/* File preview section */}
              {(() => {
                const meta = item.metadata as Record<string, unknown> | null;
                const fileName = meta?.file_name as string | undefined;
                const fileType = (meta?.file_type as string | undefined)?.toLowerCase();
                const isImage = fileType && ["jpg", "jpeg", "png", "webp", "svg", "gif"].includes(fileType);
                const isVideo = fileType && ["mp4", "webm", "mov"].includes(fileType);

                if (!fileName || !item.source_url) return null;

                return (
                  <div className="space-y-2">
                    {isImage && (
                      <img
                        src={item.source_url}
                        alt={fileName}
                        className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted/30"
                      />
                    )}
                    {isVideo && (
                      <video
                        src={item.source_url}
                        controls
                        className="w-full max-h-64 rounded-lg border border-border bg-muted/30"
                      />
                    )}
                    {!isImage && !isVideo && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
                      >
                        <Paperclip className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">{fileName}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {fileType?.toUpperCase()}
                        </span>
                        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </a>
                    )}
                  </div>
                );
              })()}

              {item.source_url && !((item.metadata as any)?.file_name) && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {item.source_url}
                </a>
              )}
              {item.content && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>
              )}
              {!item.content && !item.source_url && (
                <p className="text-sm text-muted-foreground italic">No content added yet.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
