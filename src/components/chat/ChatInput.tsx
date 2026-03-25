// forwardRef cache bust
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, X, Loader2, Sparkles, Hash, Type, Brain, ChevronDown, Check, Camera, Building2, HardHat, Cpu, TreePine, Megaphone, Flame, Clapperboard, Smile, Palette, RectangleHorizontal, RectangleVertical, Square } from "lucide-react";
import { FiberglassIcon, StirrupIcon, CageIcon, HookIcon, DowelIcon, WireMeshIcon, StraightRebarIcon } from "./ProductIcons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { useToast } from "@/hooks/use-toast";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VoiceInputButton } from "./VoiceInputButton";
import { EmojiPicker } from "./EmojiPicker";
import { SlashCommandMenu, SlashCommand } from "./SlashCommandMenu";
import { MentionMenu } from "./MentionMenu";
import { QuickTemplates } from "./QuickTemplates";
import { FormattingToolbar } from "./FormattingToolbar";
import { getSignedFileUrl } from "@/lib/storageUtils";

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
}

const IMAGE_STYLES = [
  { key: "realism", label: "Realism", icon: Camera, color: "#10b981" },
  { key: "urban", label: "Urban", icon: Building2, color: "#6366f1" },
  { key: "construction", label: "Construction", icon: HardHat, color: "#f59e0b" },
  { key: "ai_modern", label: "AI & Modern", icon: Cpu, color: "#06b6d4" },
  { key: "nature", label: "Nature", icon: TreePine, color: "#22c55e" },
  { key: "advertising", label: "Advertising", icon: Megaphone, color: "#ec4899" },
  { key: "inspirational", label: "Inspirational", icon: Flame, color: "#f97316" },
  { key: "cartoon", label: "Cartoon", icon: Smile, color: "#a855f7" },
  { key: "animation", label: "Animation", icon: Clapperboard, color: "#8b5cf6" },
  { key: "painting", label: "Painting", icon: Palette, color: "#e11d48" },
] as const;

const PRODUCT_ICONS = [
  { key: "fiberglass", label: "Fiberglass", icon: FiberglassIcon, color: "#22c55e", shape: "rounded-full" },
  { key: "stirrups", label: "Stirrups", icon: StirrupIcon, color: "#f97316", shape: "rounded-none" },
  { key: "cages", label: "Cages", icon: CageIcon, color: "#3b82f6", shape: "rounded-lg" },
  { key: "hooks", label: "Hooks", icon: HookIcon, color: "#eab308", shape: "rounded-full" },
  { key: "dowels", label: "Dowels", icon: DowelIcon, color: "#ef4444", shape: "rounded-md" },
  { key: "wire_mesh", label: "Wire Mesh", icon: WireMeshIcon, color: "#a855f7", shape: "rounded-none" },
  { key: "straight", label: "Rebar Straight", icon: StraightRebarIcon, color: "#6b7280", shape: "rounded-xl" },
] as const;

interface ChatInputProps {
  onSend: (message: string, files?: UploadedFile[]) => void;
  placeholder?: string;
  disabled?: boolean;
  showFileUpload?: boolean;
  showSmartMode?: boolean;
  minimalToolbar?: boolean;
  voiceAndAttachOnly?: boolean;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  imageStyles?: string[];
  onImageStylesChange?: (styles: string[]) => void;
  selectedProducts?: string[];
  onSelectedProductsChange?: (products: string[]) => void;
  imageAspectRatio?: string;
  onImageAspectRatioChange?: (ratio: string) => void;
}

export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(function ChatInput({
  onSend,
  placeholder = "Message...",
  disabled,
  showFileUpload = false,
  showSmartMode = false,
  minimalToolbar = false,
  voiceAndAttachOnly = false,
  selectedModel = "gemini",
  onModelChange,
  imageStyles = [],
  onImageStylesChange,
  selectedProducts = [],
  onSelectedProductsChange,
  imageAspectRatio = "1:1",
  onImageAspectRatioChange,
}, ref) {
  const [value, setValue] = useState("");
  const [smartMode, setSmartMode] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
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

  // Shared file processing logic
  const processFiles = async (files: FileList) => {
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

        const { error: uploadError } = await uploadToStorage("estimation-files", filePath, file);
        if (uploadError) {
          toast({ title: "Upload failed", description: `${file.name}: ${uploadError.message}`, variant: "destructive" });
          continue;
        }

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

  // File upload logic
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await processFiles(e.target.files);
  };

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  // Paste handler (Ctrl+V with files/images)
  const handlePaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files?.length) {
      e.preventDefault();
      processFiles(files);
    }
    // If no files in clipboard, normal text paste proceeds naturally
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
      <div ref={ref} className="p-4 border-t border-border">
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
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative bg-secondary rounded-xl border border-border/50 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30",
            isDragOver && "ring-2 ring-primary border-primary bg-primary/5"
          )}
        >
          {isDragOver && (
            <div className="absolute inset-0 bg-primary/10 rounded-xl flex items-center justify-center pointer-events-none z-10">
              <p className="text-sm font-semibold text-primary">Drop files here</p>
            </div>
          )}
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
              onPaste={handlePaste}
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
            {!minimalToolbar && (
              <>
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

              </>
            )}

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

            {/* AI Model Selector (shown in minimal mode) */}
            {minimalToolbar && onModelChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Brain className="w-4 h-4" />
                    <span>{selectedModel === "chatgpt" ? "ChatGPT" : "Gemini"}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-40 p-1 z-50 bg-popover">
                  <button
                    type="button"
                    onClick={() => onModelChange("gemini")}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                      selectedModel === "gemini" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                    )}
                  >
                    {selectedModel === "gemini" && <Check className="w-3.5 h-3.5" />}
                    {selectedModel !== "gemini" && <span className="w-3.5" />}
                    Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => onModelChange("chatgpt")}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                      selectedModel === "chatgpt" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                    )}
                  >
                    {selectedModel === "chatgpt" && <Check className="w-3.5 h-3.5" />}
                    {selectedModel !== "chatgpt" && <span className="w-3.5" />}
                    ChatGPT
                  </button>
                </PopoverContent>
            </Popover>
            )}

            {/* Style Popover (Pixel agent only) */}
            {minimalToolbar && onImageStylesChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                      imageStyles.length > 0
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    Style
                    {imageStyles.length > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                        {imageStyles.length}
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-2">
                  <div className="grid grid-cols-5 gap-1">
                    {IMAGE_STYLES.map((style) => {
                      const active = imageStyles.includes(style.key);
                      const Icon = style.icon;
                      return (
                        <Tooltip key={style.key}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                const next = active
                                  ? imageStyles.filter((s) => s !== style.key)
                                  : [...imageStyles, style.key];
                                onImageStylesChange(next);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all border-2",
                                active
                                  ? "border-current shadow-md scale-110"
                                  : "border-transparent hover:scale-105"
                              )}
                              style={{
                                color: style.color,
                                backgroundColor: active ? `${style.color}25` : `${style.color}10`,
                              }}
                            >
                              <Icon className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">{style.label}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Products Popover (Pixel agent only) */}
            {minimalToolbar && onSelectedProductsChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                      selectedProducts.length > 0
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    Products
                    {selectedProducts.length > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                        {selectedProducts.length}
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-2">
                  <div className="grid grid-cols-4 gap-1">
                    {PRODUCT_ICONS.map((prod) => {
                      const active = selectedProducts.includes(prod.key);
                      const ProdIcon = prod.icon;
                      return (
                        <Tooltip key={prod.key}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                const next = active
                                  ? selectedProducts.filter((p) => p !== prod.key)
                                  : [...selectedProducts, prod.key];
                                onSelectedProductsChange(next);
                              }}
                              className={cn(
                                "p-2 transition-all border-2",
                                prod.shape,
                                active
                                  ? "border-current shadow-lg scale-110"
                                  : "border-transparent hover:scale-105"
                              )}
                              style={{
                                color: prod.color,
                                backgroundColor: active ? `${prod.color}25` : `${prod.color}10`,
                              }}
                            >
                              <ProdIcon className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">{prod.label}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Size Popover (Pixel agent only) */}
            {minimalToolbar && onImageAspectRatioChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  >
                    {imageAspectRatio === "16:9" ? <RectangleHorizontal className="w-3.5 h-3.5" /> : imageAspectRatio === "9:16" ? <RectangleVertical className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {imageAspectRatio}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-1.5">
                  <div className="flex flex-col gap-0.5">
                    {([
                      { value: "16:9", label: "Landscape", icon: RectangleHorizontal },
                      { value: "1:1", label: "Square", icon: Square },
                      { value: "9:16", label: "Portrait", icon: RectangleVertical },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onImageAspectRatioChange(opt.value)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors",
                          imageAspectRatio === opt.value
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label} ({opt.value})
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
        {!minimalToolbar && (
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
        )}
      </div>
    </TooltipProvider>
  );
});
ChatInput.displayName = "ChatInput";
