import { useState } from "react";
import { Plus, X, Brain, Image, Video, Globe, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const categoryOptions = [
  { value: "memory", label: "Memory", icon: Brain, description: "A fact, preference, or learning" },
  { value: "image", label: "Image", icon: Image, description: "An image URL or reference" },
  { value: "video", label: "Video", icon: Video, description: "A video URL or reference" },
  { value: "webpage", label: "Webpage", icon: Globe, description: "A website or web page link" },
  { value: "document", label: "Document", icon: FileText, description: "A document or file" },
];

export function AddKnowledgeDialog({ open, onOpenChange, onSuccess }: AddKnowledgeDialogProps) {
  const [category, setCategory] = useState("memory");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("knowledge").insert({
        title: title.trim(),
        content: content.trim() || null,
        category,
        source_url: sourceUrl.trim() || null,
      });

      if (error) throw error;

      toast({ title: "Knowledge added!" });
      setTitle("");
      setContent("");
      setSourceUrl("");
      setCategory("memory");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const showUrlField = ["image", "video", "webpage", "document"].includes(category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-lg max-h-[90vh] bg-card rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Add Knowledge</h2>
          <button onClick={() => onOpenChange(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Category Selector */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-5 gap-2">
              {categoryOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCategory(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors",
                    category === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  <opt.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="knowledge-title">Title</Label>
            <Input
              id="knowledge-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Language Preference, Target Customers..."
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="knowledge-content">
              {category === "memory" ? "Details" : "Description (optional)"}
            </Label>
            <Textarea
              id="knowledge-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                category === "memory"
                  ? "Describe this memory or fact..."
                  : "Add a description..."
              }
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Source URL */}
          {showUrlField && (
            <div className="space-y-2">
              <Label htmlFor="knowledge-url">
                {category === "image" ? "Image URL" :
                 category === "video" ? "Video URL" :
                 category === "webpage" ? "Webpage URL" :
                 "Document URL"}
              </Label>
              <Input
                id="knowledge-url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={
                  category === "image" ? "https://example.com/image.jpg" :
                  category === "video" ? "https://youtube.com/watch?v=..." :
                  category === "webpage" ? "https://example.com" :
                  "https://example.com/document.pdf"
                }
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
