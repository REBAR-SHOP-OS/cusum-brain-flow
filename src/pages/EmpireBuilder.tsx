import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, ArrowUp, X, FileText, Image as ImageIcon, Archive, Sparkles } from "lucide-react";
import { Message } from "@/components/chat/ChatMessage";
import { sendAgentMessage, ChatMessage as AgentChatMessage, AttachedFile } from "@/lib/agent";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useAuth } from "@/lib/auth";
import { agentConfigs } from "@/components/agent/agentConfigs";
import { cn } from "@/lib/utils";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { MessageActions } from "@/components/chat/MessageActions";
import { supabase } from "@/integrations/supabase/client";
import { analyzeZip } from "@/lib/zipAnalyzer";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const config = agentConfigs.empire;

const SUGGESTIONS = [
  "Run a full health check on all my apps",
  "Diagnose and fix any WordPress issues on rebar.shop",
  "Check Odoo CRM sync status",
  "I have a SaaS idea for contractor scheduling",
  "Stress test my latest venture",
  "What problems need my attention right now?",
];

interface PendingFile {
  file: File;
  preview?: string; // data URL for images
  type: "image" | "pdf" | "zip" | "other";
}

export default function EmpireBuilder() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [value, setValue] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomInputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autofixTriggered = useRef(false);

  const { createSession, addMessage } = useChatSessions();
  const hasConversation = messages.length > 0;

  // Auto-resize textareas
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
  }, [value]);

  useEffect(() => {
    const ta = bottomInputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  }, [value, hasConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Autofix query param handler
  useEffect(() => {
    const autofix = searchParams.get("autofix");
    if (autofix && !autofixTriggered.current) {
      autofixTriggered.current = true;
      const errorMsg = decodeURIComponent(autofix);
      setSearchParams({}, { replace: true });
      setTimeout(() => {
        handleSend(`🔴 Auto-fix request — An error occurred in the app:\n\n\`\`\`\n${errorMsg}\n\`\`\`\n\nPlease diagnose the root cause, check all connected platforms, and create fix requests as needed.`);
      }, 500);
    }
  }, [searchParams]);

  // File processing helpers
  const classifyFile = (file: File): PendingFile["type"] => {
    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)) return "image";
    if (/\.pdf$/i.test(file.name)) return "pdf";
    if (/\.zip$/i.test(file.name)) return "zip";
    return "other";
  };

  const addFiles = (files: FileList | File[]) => {
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        continue;
      }
      const type = classifyFile(file);
      const pf: PendingFile = { file, type };
      if (type === "image") {
        pf.preview = URL.createObjectURL(file);
      }
      newFiles.push(pf);
    }
    setPendingFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const processFilesForSend = async (): Promise<{ attachedFiles: AttachedFile[]; extraContext: string }> => {
    const attachedFiles: AttachedFile[] = [];
    let extraContext = "";

    for (const pf of pendingFiles) {
      try {
        if (pf.type === "zip") {
          const result = await analyzeZip(pf.file);
          extraContext += `\n\n[ZIP Analysis: ${pf.file.name}]\n${result.summary}`;
          for (const url of result.imageUrls) {
            attachedFiles.push({ name: `${pf.file.name}-image`, url });
          }
        } else if (pf.type === "image" || pf.type === "pdf") {
          const path = `chat-uploads/${Date.now()}-${pf.file.name}`;
          const { error } = await supabase.storage.from("clearance-photos").upload(path, pf.file);
          if (error) { console.error("Upload error:", error); continue; }
          const { data: urlData } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 3600);
          if (urlData?.signedUrl) {
            attachedFiles.push({ name: pf.file.name, url: urlData.signedUrl });
          }
        }
      } catch (err) {
        console.error(`Error processing ${pf.file.name}:`, err);
      }
    }

    // Clean up previews
    pendingFiles.forEach((pf) => { if (pf.preview) URL.revokeObjectURL(pf.preview); });
    setPendingFiles([]);
    return { attachedFiles, extraContext };
  };

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Process files
    let attachedFiles: AttachedFile[] = [];
    let extraContext = "";
    if (pendingFiles.length > 0) {
      const result = await processFilesForSend();
      attachedFiles = result.attachedFiles;
      extraContext = result.extraContext;
    }

    const fullContent = content + extraContext;
    const displayContent = pendingFiles.length > 0
      ? `${content}\n\n📎 ${pendingFiles.length} file(s) attached`
      : content;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: displayContent, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setValue("");

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession(content, config.name);
      setActiveSessionId(sessionId);
    }
    if (sessionId) addMessage(sessionId, "user", content);

    try {
      const history: AgentChatMessage[] = messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));
      const response = await sendAgentMessage(config.agentType, fullContent, history, undefined, attachedFiles);
      let replyContent = response.reply;
      if (response.createdNotifications?.length) {
        const notifSummary = response.createdNotifications
          .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
          .join("\n");
        replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
      }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", content: replyContent, agent: config.agentType as any, timestamp: new Date() }]);
      if (sessionId) addMessage(sessionId, "agent", response.reply, config.agentType);
    } catch (error) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", content: `Sorry, I encountered an error. ${error instanceof Error ? error.message : ""}`, agent: config.agentType as any, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, activeSessionId, createSession, addMessage, pendingFiles]);

  const handleSubmit = () => { if (value.trim() || pendingFiles.length > 0) handleSend(value.trim() || "Analyze these files"); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const fileIcon = (type: PendingFile["type"]) => {
    if (type === "image") return <ImageIcon className="w-3.5 h-3.5" />;
    if (type === "zip") return <Archive className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  // Shared input component
  const InputBox = ({ large = false }: { large?: boolean }) => (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "backdrop-blur-sm rounded-2xl border shadow-sm transition-all",
        "bg-amber-50/80 dark:bg-card/80 border-amber-200/50 dark:border-border/50",
        "focus-within:shadow-lg focus-within:border-amber-300/60 dark:focus-within:border-primary/30",
        large && "shadow-lg shadow-amber-100/20 dark:shadow-none",
        isDragging && "border-primary/60 bg-primary/5 shadow-lg"
      )}
    >
      {/* Attachment chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/40 text-xs text-muted-foreground">
              {pf.preview ? (
                <img src={pf.preview} alt="" className="w-5 h-5 rounded object-cover" />
              ) : (
                fileIcon(pf.type)
              )}
              <span className="max-w-[120px] truncate">{pf.file.name}</span>
              <button onClick={() => removeFile(i)} className="hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={cn("px-5 pb-1", large ? "pt-4" : "pt-3", pendingFiles.length > 0 && "pt-2")}>
        <textarea
          ref={large ? textareaRef : bottomInputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={large ? "Ask Architect to build, diagnose, or drop files here..." : "Message Architect..."}
          rows={large ? 2 : 1}
          disabled={isLoading}
          className="w-full bg-transparent resize-none text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
        />
      </div>
      <div className="flex items-center px-4 pb-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.zip"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Attach file (image, PDF, ZIP)"
        >
          <Plus className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() && pendingFiles.length === 0 || isLoading}
          className={cn(
            "rounded-full flex items-center justify-center transition-all",
            large ? "w-9 h-9" : "w-8 h-8",
            (value.trim() || pendingFiles.length > 0) && !isLoading
              ? "bg-foreground text-background hover:opacity-80 shadow-sm"
              : "bg-muted/60 text-muted-foreground/30 cursor-not-allowed"
          )}
        >
          <ArrowUp className={large ? "w-4 h-4" : "w-3.5 h-3.5"} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/60 via-purple-50/30 to-pink-200/50 dark:from-blue-950/30 dark:via-purple-950/15 dark:to-pink-950/25" />
        <div className="absolute top-[-10%] left-[10%] w-[700px] h-[700px] rounded-full bg-blue-200/30 dark:bg-blue-900/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] rounded-full bg-pink-200/40 dark:bg-pink-900/10 blur-[130px]" />
        <div className="absolute top-[30%] right-[25%] w-[400px] h-[400px] rounded-full bg-violet-200/20 dark:bg-violet-900/8 blur-[110px]" />
      </div>

      {!hasConversation ? (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
          <div className="text-center mb-10 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Build something{" "}
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                great
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-md mx-auto">
              Describe your venture idea and let AI structure, validate, and execute the plan.
            </p>
          </div>

          <div className="w-full max-w-2xl mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <InputBox large />
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl animate-fade-in" style={{ animationDelay: "200ms" }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="px-4 py-2.5 text-sm rounded-full border border-border/50 bg-background/50 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background/80 hover:border-border hover:shadow-sm transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative z-10 min-h-0">
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={cn("flex gap-3 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                        <span className="text-white text-xs font-bold">A</span>
                      </div>
                    )}
                    <div className={cn("max-w-[80%] min-w-0")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed min-w-0 [overflow-wrap:anywhere]",
                          isUser
                            ? "bg-foreground text-background rounded-br-md"
                            : "bg-background/80 backdrop-blur-sm border border-border/40 shadow-sm rounded-bl-md"
                        )}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <RichMarkdown content={message.content || ""} />
                        )}
                      </div>
                      {!isUser && message.content && (
                        <MessageActions content={message.content} messageId={message.id} />
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white text-xs font-bold">A</span>
                  </div>
                  <div className="bg-background/80 backdrop-blur-sm border border-border/40 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-border/20 bg-background/40 backdrop-blur-md px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <InputBox />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
