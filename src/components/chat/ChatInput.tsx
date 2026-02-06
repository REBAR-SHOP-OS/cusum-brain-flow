import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
}

interface ChatInputProps {
  onSend: (message: string, files?: UploadedFile[]) => void;
  placeholder?: string;
  disabled?: boolean;
  showFileUpload?: boolean;
}

export function ChatInput({ 
  onSend, 
  placeholder = "Message...", 
  disabled,
  showFileUpload = false
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to upload files",
          variant: "destructive",
        });
        return;
      }

      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop() || 'bin';
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('estimation-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}: ${uploadError.message}`,
            variant: "destructive",
          });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('estimation-files')
          .getPublicUrl(filePath);

        newFiles.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: publicUrl,
          path: filePath,
        });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);

      if (newFiles.length > 0) {
        toast({
          title: "Files uploaded",
          description: `${newFiles.length} file(s) uploaded successfully`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = async (index: number) => {
    const file = uploadedFiles[index];
    
    try {
      await supabase.storage
        .from('estimation-files')
        .remove([file.path]);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }

    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if ((value.trim() || uploadedFiles.length > 0) && !disabled && !isUploading) {
      onSend(value.trim(), uploadedFiles.length > 0 ? uploadedFiles : undefined);
      setValue("");
      setUploadedFiles([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    // AutoCAD and engineering files
    if (['dwg', 'dxf', 'dwf', 'dgn', 'rvt', 'rfa', 'ifc'].includes(ext)) {
      return '📐';
    }
    // PDF
    if (type.includes('pdf') || ext === 'pdf') {
      return '📄';
    }
    // Images
    if (type.includes('image')) {
      return '🖼️';
    }
    // Spreadsheets
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return '📊';
    }
    return '📁';
  };

  return (
    <div className="p-4 border-t border-border">
      {/* Uploaded files preview */}
      {uploadedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 text-sm"
            >
              <span>{getFileIcon(file.type, file.name)}</span>
              <div className="flex flex-col">
                <span className="font-medium truncate max-w-[150px]">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-destructive/20 rounded transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 bg-secondary rounded-lg p-2">
        {showFileUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              // No restrictions on file types
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "p-2 text-muted-foreground hover:text-foreground transition-colors",
                isUploading && "opacity-50 cursor-not-allowed"
              )}
              title="Attach files (drawings, AutoCAD, PDF, etc.)"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </button>
          </>
        )}

        {!showFileUpload && (
          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors opacity-50 cursor-not-allowed"
            title="File upload not available for this agent"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          rows={1}
          className={cn(
            "flex-1 bg-transparent resize-none text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none",
            "disabled:opacity-50"
          )}
        />

        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={(!value.trim() && uploadedFiles.length === 0) || disabled || isUploading}
          className="h-9 w-9"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        AI drafts only • Human approval required for actions
      </p>
    </div>
  );
}
