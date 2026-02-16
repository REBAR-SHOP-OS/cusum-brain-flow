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
import { PatchReview } from "@/components/chat/PatchReview";
import { supabase } from "@/integrations/supabase/client";
import { analyzeZip } from "@/lib/zipAnalyzer";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EmpireSidebar } from "@/components/empire/EmpireSidebar";
import { EmpireTopbar } from "@/components/empire/EmpireTopbar";

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
  preview?: string;
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
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} is too large (max 20MB)`); continue; }
      const type = classifyFile(file);
      const pf: PendingFile = { file, type };
      if (type === "image") pf.preview = URL.createObjectURL(file);
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
          for (const url of result.imageUrls) attachedFiles.push({ name: `${pf.file.name}-image`, url });
        } else if (pf.type === "image" || pf.type === "pdf") {
          const path = `chat-uploads/${Date.now()}-${pf.file.name}`;
          const { error } = await supabase.storage.from("clearance-photos").upload(path, pf.file);
          if (error) { console.error("Upload error:", error); continue; }
          const { data: urlData } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 3600);
          if (urlData?.signedUrl) attachedFiles.push({ name: pf.file.name, url: urlData.signedUrl });
        }
      } catch (err) { console.error(`Error processing ${pf.file.name}:`, err); }
    }
    pendingFiles.forEach((pf) => { if (pf.preview) URL.revokeObjectURL(pf.preview); });
    setPendingFiles([]);
    return { attachedFiles, extraContext };
  };

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    let attachedFiles: AttachedFile[] = [];
    let extraContext = "";
    if (pendingFiles.length > 0) {
      const result = await processFilesForSend();
      attachedFiles = result.attachedFiles;
      extraContext = result.extraContext;
    }
    const fullContent = content + extraContext;
    const displayContent = pendingFiles.length > 0 ? `${content}\n\n📎 ${pendingFiles.length} file(s) attached` : content;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: displayContent, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setValue("");
    let sessionId = activeSessionId;
    if (!sessionId) { sessionId = await createSession(content, config.name); setActiveSessionId(sessionId); }
    if (sessionId) addMessage(sessionId, "user", content);
    try {
      const history: AgentChatMessage[] = messages.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content }));
      const response = await sendAgentMessage(config.agentType, fullContent, history, undefined, attachedFiles);
      let replyContent = response.reply;
      if (response.createdNotifications?.length) {
        const notifSummary = response.createdNotifications.map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`).join("\n");
        replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
      }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", content: replyContent, agent: config.agentType as any, timestamp: new Date() }]);
      if (sessionId) addMessage(sessionId, "agent", response.reply, config.agentType);
    } catch (error) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", content: `Sorry, I encountered an error. ${error instanceof Error ? error.message : ""}`, agent: config.agentType as any, timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  }, [messages, isLoading, activeSessionId, createSession, addMessage, pendingFiles]);

  const handleSubmit = () => { if (value.trim() || pendingFiles.length > 0) handleSend(value.trim() || "Analyze these files"); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  const fileIcon = (type: PendingFile["type"]) => {
    if (type === "image") return <ImageIcon className="w-3.5 h-3.5" />;
    if (type === "zip") return <Archive className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  const InputBox = ({ large = false }: { large?: boolean }) => (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "backdrop-blur rounded-2xl border shadow-sm transition-all",
        "bg-white/5 border-white/10",
        "focus-within:shadow-lg focus-within:border-white/20",
        large && "shadow-lg",
        isDragging && "border-cyan-400/60 bg-cyan-500/5 shadow-lg"
      )}
    >
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs text-white/70">
              {pf.preview ? <img src={pf.preview} alt="" className="w-5 h-5 rounded object-cover" /> : fileIcon(pf.type)}
              <span className="max-w-[120px] truncate">{pf.file.name}</span>
              <button onClick={() => removeFile(i)} className="hover:text-red-400 transition-colors"><X className="w-3 h-3" /></button>
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
          className="w-full bg-transparent resize-none text-sm leading-relaxed text-white placeholder:text-white/40 focus:outline-none disabled:opacity-50"
        />
      </div>
      <div className="flex items-center px-4 pb-3">
        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.zip" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition" title="Attach file">
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
              ? "bg-[#35E6E6] text-black hover:opacity-80 shadow-sm"
              : "bg-white/10 text-white/30 cursor-not-allowed"
          )}
        >
          <ArrowUp className={large ? "w-4 h-4" : "w-3.5 h-3.5"} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#070A12] text-white">
      <div className="flex min-h-screen">
        <EmpireSidebar />
        <main className="flex-1 flex flex-col min-h-0">
          <EmpireTopbar />

          {!hasConversation ? (
            <section className="relative flex-1 overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_20%,rgba(60,184,183,0.18),transparent_45%),radial-gradient(900px_circle_at_70%_70%,rgba(255,122,0,0.18),transparent_45%),linear-gradient(135deg,#0A0F25_0%,#141B3A_35%,#221B3B_70%,#301D2E_100%)]" />
              <div className="absolute inset-0 bg-black/10" />

              {/* Floating avatar bubble */}
              <div className="absolute right-10 top-16 hidden lg:block">
                <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-300/60 to-purple-400/60" />
                </div>
              </div>

              {/* Center hero */}
              <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 text-center">
                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight animate-fade-in">
                  Build something{" "}
                  <span className="text-[#FF7A18]">great</span>
                </h1>
                <p className="mt-3 max-w-xl text-sm text-white/70 animate-fade-in" style={{ animationDelay: "100ms" }}>
                  Describe your venture idea and let AI structure, validate, and execute the plan.
                </p>

                <div className="mt-10 w-full max-w-2xl animate-fade-in" style={{ animationDelay: "150ms" }}>
                  <InputBox large />
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-3 animate-fade-in" style={{ animationDelay: "250ms" }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <div className="flex-1 flex flex-col relative min-h-0">
              {/* Background gradient for chat */}
              <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_20%,rgba(60,184,183,0.10),transparent_45%),radial-gradient(900px_circle_at_70%_70%,rgba(255,122,0,0.10),transparent_45%),linear-gradient(135deg,#0A0F25_0%,#141B3A_35%,#221B3B_70%,#301D2E_100%)] pointer-events-none" />

              <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 relative z-10">
                <div className="max-w-3xl mx-auto space-y-6">
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    return (
                      <div key={message.id} className={cn("flex gap-3 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
                        {!isUser && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                            <span className="text-black text-xs font-bold">A</span>
                          </div>
                        )}
                        <div className="max-w-[80%] min-w-0">
                          <div className={cn(
                            "rounded-2xl px-4 py-3 text-sm leading-relaxed min-w-0 [overflow-wrap:anywhere]",
                            isUser
                              ? "bg-[#35E6E6] text-black rounded-br-md"
                              : "bg-white/5 backdrop-blur border border-white/10 text-white rounded-bl-md"
                          )}>
                            {isUser ? (
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            ) : (
                              <>
                                <RichMarkdown content={message.content || ""} />
                                {(() => {
                                  const patches: { id: string; file: string; target: string; description?: string; content: string }[] = [];
                                  const artifactRegex = /\{"type"\s*:\s*"patch"[^}]*"id"\s*:\s*"([^"]+)"[^}]*"file"\s*:\s*"([^"]+)"[^}]*"target"\s*:\s*"([^"]+)"[^}]*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
                                  let match;
                                  const text = message.content || "";
                                  while ((match = artifactRegex.exec(text)) !== null) {
                                    patches.push({ id: match[1], file: match[2], target: match[3], content: match[4].replace(/\\n/g, "\n").replace(/\\"/g, '"') });
                                  }
                                  const patchBlockRegex = /<!--\s*PATCH:(\w+):([^:]+):([^:]+):(\S+)\s*-->\n```[\w]*\n([\s\S]*?)```/g;
                                  while ((match = patchBlockRegex.exec(text)) !== null) {
                                    patches.push({ id: match[1], target: match[2], file: match[3], description: match[4].replace(/_/g, " "), content: match[5].trim() });
                                  }
                                  return patches.map((p) => (
                                    <PatchReview key={p.id} patchId={p.id} filePath={p.file} targetSystem={p.target} description={p.description || ""} content={p.content} />
                                  ));
                                })()}
                              </>
                            )}
                          </div>
                          {!isUser && message.content && <MessageActions content={message.content} messageId={message.id} />}
                        </div>
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div className="flex gap-3 animate-fade-in">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-black text-xs font-bold">A</span>
                      </div>
                      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>

              <div className="border-t border-white/10 bg-black/30 backdrop-blur-xl px-4 py-3 relative z-10">
                <div className="max-w-3xl mx-auto">
                  <InputBox />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
