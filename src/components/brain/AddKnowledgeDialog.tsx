import { useState, useRef } from "react";
import { Plus, X, Brain, Image, Video, Globe, FileText, Loader2, Upload, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultMetadata?: Record<string, unknown>;
}

interface UploadedFile {
  name: string;
  url: string;
  path: string;
}

const categoryOptions = [
  { value: "memory", label: "Memory", icon: Brain },
  { value: "image", label: "Image", icon: Image },
  { value: "video", label: "Video", icon: Video },
  { value: "webpage", label: "Webpage", icon: Globe },
  { value: "document", label: "Document", icon: FileText },
];

const acceptByCategory: Record<string, string> = {
  image: "image/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.pptx",
  video: "video/*",
};

export function AddKnowledgeDialog({ open, onOpenChange, onSuccess, defaultMetadata }: AddKnowledgeDialogProps) {
  const [category, setCategory] = useState("memory");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { companyId } = useCompanyId();
  const { toast } = useToast();

  if (!open) return null;

  const supportsUpload = ["image", "document", "video"].includes(category);
  const showUrlField = ["image", "video", "webpage", "document"].includes(category);
  const isMultiFile = uploadedFiles.length > 1;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please log in to upload files", variant: "destructive" });
        return;
      }

      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const filePath = `${user.id}/brain/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("estimation-files")
          .upload(filePath, file);

        if (uploadError) {
          toast({ title: `Failed to upload ${file.name}`, description: uploadError.message, variant: "destructive" });
          continue;
        }

        const { getSignedFileUrl } = await import("@/lib/storageUtils");
        const publicUrl = await getSignedFileUrl(filePath);
        newFiles.push({ name: file.name, url: publicUrl, path: filePath });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);

      // Auto-fill title only if single file and title is empty
      if (newFiles.length === 1 && uploadedFiles.length === 0 && !title.trim()) {
        setTitle(newFiles[0].name.replace(/\.[^/.]+$/, ""));
      }

      if (newFiles.length > 0) {
        toast({ title: `${newFiles.length} file${newFiles.length > 1 ? "s" : ""} uploaded!` });
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async (index: number) => {
    const file = uploadedFiles[index];
    if (file) {
      try {
        await supabase.storage.from("estimation-files").remove([file.path]);
      } catch {}
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    // If multi-file, title is optional (each file uses its own name)
    if (!isMultiFile && !title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!companyId) {
      toast({ title: "Still loading your workspace, please try again", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (uploadedFiles.length > 1) {
        // Multi-file: create one record per file
        const records = uploadedFiles.map(f => ({
          title: f.name.replace(/\.[^/.]+$/, ""),
          content: content.trim() || null,
          category,
          source_url: f.url,
          metadata: {
            ...(defaultMetadata || {}),
            file_name: f.name,
            file_type: f.name.split(".").pop(),
          },
          company_id: companyId,
        }));

        const { error } = await supabase.from("knowledge").insert(records);
        if (error) throw error;
      } else {
        // Single file or no file
        const { error } = await supabase.from("knowledge").insert({
          title: title.trim(),
          content: content.trim() || null,
          category,
          source_url: uploadedFiles.length === 1 ? uploadedFiles[0].url : (sourceUrl.trim() || null),
          metadata: (defaultMetadata || uploadedFiles.length > 0) ? {
            ...(defaultMetadata || {}),
            ...(uploadedFiles.length > 0 ? { file_name: uploadedFiles[0].name, file_type: uploadedFiles[0].name.split(".").pop() } : {}),
          } : null,
          company_id: companyId,
        });
        if (error) throw error;
      }

      toast({ title: "Knowledge added!" });
      setTitle("");
      setContent("");
      setSourceUrl("");
      setCategory("memory");
      setUploadedFiles([]);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    if (uploadedFiles.length > 0) {
      // Clear all uploads when switching categories
      uploadedFiles.forEach(f => {
        supabase.storage.from("estimation-files").remove([f.path]).catch(() => {});
      });
      setUploadedFiles([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] bg-card rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Category Selector */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {categoryOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleCategoryChange(opt.value)}
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

          {/* File Upload Area */}
          {supportsUpload && (
            <div className="space-y-2">
              <Label>Upload File{uploadedFiles.length > 0 ? `s (${uploadedFiles.length})` : ""}</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptByCategory[category] || "*"}
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                      <Paperclip className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl",
                  "hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Uploading..." : uploadedFiles.length > 0 ? "Add more files" : "Click to upload files"}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {category === "image" ? "JPG, PNG, WebP, SVG" :
                   category === "video" ? "MP4, WebM, MOV" :
                   "PDF, DOC, XLSX, CSV, TXT"}
                </span>
              </button>

              {uploadedFiles.length === 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or paste a URL</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="knowledge-title">Title {isMultiFile && <span className="text-xs text-muted-foreground">(optional for multi-file)</span>}</Label>
            <Input
              id="knowledge-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMultiFile ? "Each file will use its own name" : "e.g. Language Preference, Target Customers..."}
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
          {showUrlField && uploadedFiles.length === 0 && (
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
          <Button
            className="flex-1 gap-2"
            onClick={handleSave}
            disabled={saving || (!isMultiFile && !title.trim()) || uploading}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isMultiFile ? `Add ${uploadedFiles.length} Files` : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
