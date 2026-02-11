import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, X, Loader2, Sparkles, Hash, Type, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoiceInputButton } from "./VoiceInputButton";
import { EmojiPicker } from "./EmojiPicker";
import { SlashCommandMenu, SlashCommand } from "./SlashCommandMenu";
import { MentionMenu } from "./MentionMenu";
import { QuickTemplates } from "./QuickTemplates";
import { FormattingToolbar } from "./FormattingToolbar";

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
  showSmartMode?: boolean;
  onLiveChatClick?: () => void;
}

export function ChatInput({
  onSend,
  placeholder = "Message...",
  disabled,
  showFileUpload = false,
  showSmartMode = false,
  onLiveChatClick,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [smartMode, setSmartMode] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const speech = useSpeechRecognition({
    onError: (error) => toast({ title: "Voice Input", description: error, variant: "destructive" }),
  });

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [value]);

  // Append speech transcripts to value
  useEffect(() => {
    if (speech.fullTranscript) {
      setValue((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${speech.fullTranscript}` : speech.fullTranscript;
      });
    }
  }, [speech.fullTranscript]);

  // Detect slash commands and mentions
  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue);

    // Slash command detection
    if (newValue === "/" || (newValue.startsWith("/") && !newValue.includes(" "))) {
      setSlashOpen(true);
      setSlashFilter(newValue.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }

    // Mention detection
    const atMatch = newValue.match(/@(\w*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionFilter(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  }, []);

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setValue(cmd.value);
    setSlashOpen(false);
    textareaRef.current?.focus();
  }, []);

  const handleMentionSelect = useCallback((item: { label: string }) => {
    setValue((prev) => prev.replace(/@\w*$/, `@${item.label} `));
    setMentionOpen(false);
    textareaRef.current?.focus();
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = value.slice(0, start) + emoji + value.slice(end);
      setValue(newVal);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      });
    } else {
      setValue((prev) => prev + emoji);
    }
  }, [value]);

  const handleFormat = useCallback((prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const newVal = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    setValue(newVal);
    requestAnimationFrame(() => {
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length + selected.length;
      textarea.focus();
    });
  }, [value]);

  const handleTemplateSelect = useCallback((text: string) => {
    setValue(text);
    textareaRef.current?.focus();
  }, []);

  const handleVoiceToggle = useCallback(() => {
    if (speech.isListening) {
      speech.stop();
    } else if (!speech.isSupported) {
      toast({ title: "Voice Input", description: "Voice input is not supported on this browser. Try Chrome on desktop.", variant: "destructive" });
    } else {
      speech.start();
    }
  }, [speech, toast]);

  // File upload logic
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Authentication required", description: "Please log in to upload files", variant: "destructive" });
        return;
      }

      const newFiles: UploadedFile[] = [];
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop() || "bin";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("estimation-files").upload(filePath, file);
        if (uploadError) {
          toast({ title: "Upload failed", description: `${file.name}: ${uploadError.message}`, variant: "destructive" });
          continue;
        }

        const { getSignedFileUrl } = await import("@/lib/storageUtils");
        const signedUrl = await getSignedFileUrl(filePath);
        newFiles.push({ name: file.name, size: file.size, type: file.type || "application/octet-stream", url: signedUrl, path: filePath });
      }

      setUploadedFiles((prev) => [...prev, ...newFiles]);
      if (newFiles.length > 0) toast({ title: "Files uploaded", description: `${newFiles.length} file(s) uploaded` });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async (index: number) => {
    const file = uploadedFiles[index];
    try {
      await supabase.storage.from("estimation-files").remove([file.path]);
    } catch {}
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if ((value.trim() || uploadedFiles.length > 0) && !disabled && !isUploading) {
      if (speech.isListening) speech.stop();
      onSend(value.trim(), uploadedFiles.length > 0 ? uploadedFiles : undefined);
      setValue("");
      setUploadedFiles([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navigate slash commands
    if (slashOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => i + 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Escape") { e.preventDefault(); setSlashOpen(false); return; }
    }
    // Navigate mentions
    if (mentionOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => i + 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (type: string, name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (["dwg", "dxf", "dwf", "dgn", "rvt", "rfa", "ifc"].includes(ext)) return "📐";
    if (type.includes("pdf") || ext === "pdf") return "📄";
    if (type.includes("image")) return "🖼️";
    if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
    return "📁";
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-4 border-t border-border">
        {/* Uploaded files preview */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                <span>{getFileIcon(file.type, file.name)}</span>
                <div className="flex flex-col">
                  <span className="font-medium truncate max-w-[150px]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
                <button type="button" onClick={() => removeFile(index)} className="p-1 hover:bg-destructive/20 rounded transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Voice recording indicator */}
        {speech.isListening && (
          <div className="mb-2 flex items-center gap-2 text-sm text-destructive animate-pulse px-1">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Listening... {speech.interimText && <span className="text-muted-foreground italic truncate">"{speech.interimText}"</span>}
          </div>
        )}

        {/* Main input container */}
        <div className="relative bg-secondary rounded-xl border border-border/50 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30">
          {/* Formatting toolbar */}
          <FormattingToolbar onFormat={handleFormat} disabled={disabled} visible={showFormatting} />

          {/* Slash command menu */}
          <SlashCommandMenu
            isOpen={slashOpen}
            filter={slashFilter}
            selectedIndex={slashIndex}
            onSelect={handleSlashSelect}
            onClose={() => setSlashOpen(false)}
          />

          {/* Mention menu */}
          <MentionMenu
            isOpen={mentionOpen}
            filter={mentionFilter}
            selectedIndex={mentionIndex}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />

          {/* Textarea */}
          <div className="px-3 pt-3 pb-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isUploading}
              rows={1}
              className={cn(
                "w-full bg-transparent resize-none text-sm leading-relaxed",
                "placeholder:text-muted-foreground",
                "focus:outline-none",
                "disabled:opacity-50"
              )}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center gap-0.5 px-2 pb-2">
            {/* Left actions */}
            {showFileUpload && (
              <>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className={cn(
                        "p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50",
                        isUploading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Attach files</TooltipContent>
                </Tooltip>
              </>
            )}

            <EmojiPicker onSelect={handleEmojiSelect} disabled={disabled} />
            <VoiceInputButton isListening={speech.isListening} isSupported={speech.isSupported} onToggle={handleVoiceToggle} disabled={disabled} />
            <QuickTemplates onSelect={handleTemplateSelect} disabled={disabled} />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowFormatting(!showFormatting)}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    showFormatting ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Type className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Formatting</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    const textarea = textareaRef.current;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const newVal = value.slice(0, start) + "/" + value.slice(start);
                      handleValueChange(newVal);
                      textarea.focus();
                    }
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                >
                  <Hash className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Commands (/)</TooltipContent>
            </Tooltip>

            {onLiveChatClick && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onLiveChatClick}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Voice Chat</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new Event("open-live-chat"))}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Live Chat</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Send button */}
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={(!value.trim() && uploadedFiles.length === 0) || disabled || isUploading}
              className="h-9 w-9 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Footer: Smart mode + disclaimer */}
        <div className="flex items-center justify-between mt-2 px-1">
          {showSmartMode ? (
            <button
              onClick={() => setSmartMode(!smartMode)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors",
                smartMode ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className={cn("w-3.5 h-3.5", smartMode && "text-primary")} />
              Smart mode {smartMode ? "on" : "off"}
            </button>
          ) : (
            <div />
          )}
          <p className="text-xs text-muted-foreground">
            Type <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd> for commands · <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">@</kbd> to mention
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
