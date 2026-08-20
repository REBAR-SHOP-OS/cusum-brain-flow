import { useState, useRef, useCallback } from "react";
import { Sparkles, Loader2, Send, Plus, Paperclip, FileText, Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WorkspaceMode, PendingFile } from "@/hooks/useAppBuilderProject";

interface Props {
  onGenerate: (prompt: string) => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  isGenerating: boolean;
  isChatLoading: boolean;
  mode: WorkspaceMode;
  onModeChange: (m: WorkspaceMode) => void;
  pendingFiles: PendingFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
}

export function AppBuilderPromptBar({
  onGenerate,
  onSendMessage,
  isGenerating,
  isChatLoading,
  mode,
  onModeChange,
  pendingFiles,
  onAddFiles,
  onRemoveFile,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isGenerating || isChatLoading;

  const handleSubmit = () => {
    if (!prompt.trim() || isBusy) return;
    if (mode === "build") {
      onGenerate(prompt.trim());
    } else {
      onSendMessage(prompt.trim());
    }
    setPrompt("");
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        onAddFiles(Array.from(e.target.files));
        e.target.value = "";
      }
    },
    [onAddFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        onAddFiles(Array.from(e.dataTransfer.files));
      }
    },
    [onAddFiles]
  );

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 mb-6"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Header row: label + mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-foreground">
            {mode === "build" ? "Build Mode" : "Chat Mode"}
          </span>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {(["build", "chat"] as WorkspaceMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pendingFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs"
            >
              {f.previewUrl ? (
                <img src={f.previewUrl} alt="" className="w-5 h-5 rounded object-cover" />
              ) : (
                <FileText className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-foreground max-w-[120px] truncate">{f.file.name}</span>
              <button onClick={() => onRemoveFile(f.id)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* + menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-xl">
              <Plus className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="w-4 h-4 mr-2" />
              Attach File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const input = fileInputRef.current;
              if (input) { input.accept = "image/*"; input.click(); input.accept = ""; }
            }}>
              <Image className="w-4 h-4 mr-2" />
              Add Image
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "build"
              ? "Describe the app you want to build..."
              : "Ask the Architect agent anything..."
          }
          className="flex-1 bg-muted rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 min-h-[48px] max-h-[120px]"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isBusy}
          size="icon"
          className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
        >
          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
