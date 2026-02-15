import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Square, Trash2, ShieldAlert, CheckCircle2, XCircle, Paperclip, X, Image as ImageIcon, Maximize2, Minimize2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAdminChat } from "@/hooks/useAdminChat";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TOOL_LABELS: Record<string, string> = {
  wp_update_post: "Update WordPress Post",
  wp_update_page: "Update WordPress Page",
  wp_update_product: "Update WooCommerce Product",
  wp_update_order_status: "Update WooCommerce Order",
  wp_create_redirect: "Create 301 Redirect",
};

const QUICK_ACTIONS = [
  "List all pages",
  "Check site health",
  "Show recent posts",
  "List products",
];

interface Attachment {
  file: File;
  previewUrl: string;
  uploading: boolean;
}

interface WebsiteChatProps {
  currentPagePath: string;
  onWriteConfirmed?: () => void;
  chatMode?: "normal" | "fullscreen" | "minimized";
  onChatModeChange?: (mode: "normal" | "fullscreen" | "minimized") => void;
}

export function WebsiteChat({ currentPagePath, onWriteConfirmed, chatMode = "normal", onChatModeChange }: WebsiteChatProps) {
  const chat = useAdminChat(`/website`);
  const { messages, isStreaming, pendingAction, sendMessage, confirmAction, cancelAction, clearChat, cancelStream } = chat;

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newAttachments: Attachment[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type === "application/pdf")
      .slice(0, 5)
      .map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: false,
      }));
    if (newAttachments.length === 0) {
      toast.error("Only images and PDFs are supported");
      return;
    }
    setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const uploadFile = async (file: File): Promise<string | null> => {
    const path = `chat-uploads/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("clearance-photos").upload(path, file);
    if (error) {
      console.error("Upload failed:", error);
      return null;
    }
    const { data: urlData } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 3600);
    return urlData?.signedUrl || null;
  };

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || pendingAction) return;

    let messageText = input.trim();
    const contextPrefix = `[Currently viewing: rebar.shop${currentPagePath}]\n`;
    const imageUrls: string[] = [];

    // Upload attachments
    if (attachments.length > 0) {
      setAttachments((prev) => prev.map((a) => ({ ...a, uploading: true })));
      for (const att of attachments) {
        const url = await uploadFile(att.file);
        if (url) {
          if (att.file.type.startsWith("image/")) {
            imageUrls.push(url);
          } else {
            // Non-image files still get appended as links
            messageText = messageText
              ? `${messageText}\n\n[Attached file](${url})`
              : `[Attached file](${url})`;
          }
        }
      }
      // Cleanup
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAttachments([]);

      // Add image note to display text (but actual analysis goes via imageUrls)
      if (imageUrls.length > 0 && !messageText) {
        messageText = "Analyze this image";
      }
    }

    if (!messageText) return;
    sendMessage(contextPrefix + messageText, imageUrls.length > 0 ? imageUrls : undefined);
    setInput("");
  }, [input, attachments, isStreaming, pendingAction, currentPagePath, sendMessage]);

  const handleConfirm = useCallback(async () => {
    await confirmAction();
    onWriteConfirmed?.();
  }, [confirmAction, onWriteConfirmed]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && pendingAction) {
      e.preventDefault();
      cancelAction();
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  }, [addFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    if (fileRef.current) fileRef.current.value = "";
  }, [addFiles]);

  const formatActionArgs = (args: Record<string, any>) => {
    return Object.entries(args)
      .filter(([k]) => k !== "tool_call_id")
      .map(([key, value]) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
          <span className="font-mono text-foreground truncate ml-2">{String(value).slice(0, 60)}</span>
        </div>
      ));
  };

  const isUploading = attachments.some((a) => a.uploading);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold">AI Job Site Editor</h2>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChatModeChange?.(chatMode === "fullscreen" ? "normal" : "fullscreen")}
            title={chatMode === "fullscreen" ? "Exit fullscreen" : "Fullscreen"}
          >
            {chatMode === "fullscreen" ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChatModeChange?.(chatMode === "minimized" ? "normal" : "minimized")}
            title={chatMode === "minimized" ? "Expand" : "Minimize"}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-3 w-full overflow-hidden">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask me to edit your job site
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {QUICK_ACTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      const contextPrefix = `[Currently viewing: rebar.shop${currentPagePath}]\n`;
                      sendMessage(contextPrefix + q);
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-muted hover:bg-accent transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-xl px-3 py-2 text-sm max-w-[85%] overflow-hidden min-w-0 [overflow-wrap:anywhere] [word-break:break-word]",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <RichMarkdown content={msg.content} className="text-sm [&_p]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all [&_p]:[overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all" />
              ) : (
                <p className="whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                  {/* Strip the context prefix from display */}
                  {msg.content.replace(/^\[Currently viewing:.*?\]\n/, "")}
                </p>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="mr-auto bg-muted rounded-xl px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Confirmation Card */}
      {pendingAction && (
        <div className="px-3 pb-2 shrink-0">
          <Card className="border-l-4 border-l-yellow-500 bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-yellow-500 shrink-0" />
              <p className="text-xs font-semibold">Confirm action</p>
            </div>
            <div className="space-y-1 bg-muted/50 rounded-lg p-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Action</span>
                <span className="font-semibold">{TOOL_LABELS[pendingAction.tool] || pendingAction.tool}</span>
              </div>
              {formatActionArgs(pendingAction.args)}
            </div>
            <div className="flex justify-end gap-1.5">
              <Button variant="outline" size="sm" onClick={cancelAction} disabled={isStreaming} className="h-7 text-xs gap-1">
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={isStreaming} className="h-7 text-xs gap-1 bg-yellow-600 hover:bg-yellow-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="px-3 pb-1 shrink-0 flex gap-2 flex-wrap">
          {attachments.map((att, i) => (
            <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border bg-muted">
              {att.file.type.startsWith("image/") ? (
                <img src={att.previewUrl} alt="attachment" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              {att.uploading && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
              {!att.uploading && (
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex gap-2 items-end">
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-lg shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={isStreaming || !!pendingAction || isUploading}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={pendingAction ? "Approve or cancel the action above..." : "Edit your job site..."}
            className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            rows={1}
            disabled={isStreaming || !!pendingAction || isUploading}
          />
          {isStreaming ? (
            <Button size="icon" variant="destructive" className="h-9 w-9 rounded-lg shrink-0" onClick={cancelStream}>
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-9 w-9 rounded-lg shrink-0"
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || !!pendingAction || isUploading}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
