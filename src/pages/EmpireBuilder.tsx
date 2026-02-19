import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, ArrowUp, X, FileText, Image as ImageIcon, Archive, Globe, Boxes, Activity, Brain, Bug, ChevronDown, ChevronRight, Copy, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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
import { EmpireTopbar } from "@/components/empire/EmpireTopbar";
import { Badge } from "@/components/ui/badge";
import { useCompanyId } from "@/hooks/useCompanyId";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const config = agentConfigs.empire;

const SUGGESTIONS = [
  "Run a full health check on all my apps",
  "Diagnose and fix any WordPress issues on rebar.shop",
  "Check Odoo CRM sync status",
  "I have a SaaS idea for contractor scheduling",
  "Stress test my latest venture",
  "What problems need my attention right now?",
];

interface EmpireProject {
  name: string;
  icon: React.ElementType;
  color: string;
  status: "active" | "paused";
  prompt: string;
}

const DEFAULT_PROJECTS: EmpireProject[] = [
  { name: "rebar.shop", icon: Globe, color: "from-cyan-400 to-blue-500", status: "active", prompt: "Run a diagnostic on rebar.shop" },
  { name: "ERP", icon: Boxes, color: "from-purple-400 to-indigo-500", status: "active", prompt: "Check ERP system status" },
  { name: "ODOO", icon: Activity, color: "from-orange-400 to-red-500", status: "active", prompt: "Check Odoo CRM sync status" },
];

interface PendingFile {
  file: File;
  preview?: string;
  type: "image" | "pdf" | "zip" | "other";
}

interface MemoryEntry {
  id: string;
  category: string;
  content: string;
  created_at: string;
}

interface FixTicket {
  id: string;
  severity: string;
  system_area: string | null;
  status: string;
  page_url: string | null;
  repro_steps: string | null;
  actual_result: string | null;
  fix_output: string | null;
  fix_output_type: string | null;
  verification_result: string | null;
  created_at: string;
}

const severityColor: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const statusColor: Record<string, string> = {
  new: "bg-cyan-500/20 text-cyan-400",
  in_progress: "bg-purple-500/20 text-purple-400",
  fixed: "bg-emerald-500/20 text-emerald-400",
  blocked: "bg-red-500/20 text-red-400",
  verified: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
};

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

  // Projects state
  const [projects, setProjects] = useState<EmpireProject[]>(DEFAULT_PROJECTS);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Memory state
  const [memories, setMemories] = useState<MemoryEntry[]>([]);

  // Fix tickets state
  const [fixTickets, setFixTickets] = useState<FixTicket[]>([]);
  const [ticketsPanelOpen, setTicketsPanelOpen] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const { companyId } = useCompanyId();

  const { createSession, addMessage } = useChatSessions();
  const hasConversation = messages.length > 0;

  // Fetch memories
  useEffect(() => {
    supabase
      .from("vizzy_memory")
      .select("id, category, content, created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setMemories(data as MemoryEntry[]); });
  }, []);

  // Fetch fix tickets
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("fix_tickets")
      .select("id, severity, system_area, status, page_url, repro_steps, actual_result, fix_output, fix_output_type, verification_result, created_at")
      .eq("company_id", companyId)
      .in("status", ["new", "in_progress", "fixed", "blocked", "failed"])
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setFixTickets(data as FixTicket[]); });
  }, [companyId]);

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
    const taskId = searchParams.get("task_id");
    if (autofix && !autofixTriggered.current) {
      autofixTriggered.current = true;
      const errorMsg = decodeURIComponent(autofix);
      setSearchParams({}, { replace: true });
      const taskRef = taskId ? `\n\n**Task ID:** \`${taskId}\`\nUse \`read_task\` to get full details, then fix the problem using your write tools, and finally call \`resolve_task\` to mark it completed.` : "";
      setTimeout(() => {
        handleSend(`🔴 Auto-fix request — Fix this problem NOW:\n\n\`\`\`\n${errorMsg}\n\`\`\`${taskRef}\n\nIMPORTANT INSTRUCTIONS:\n- If you CAN fix it with your write tools → do it immediately, then call resolve_task.\n- If you CANNOT fix it with your tools, do NOT create a fix request or ticket.\n- Instead: (1) Ask me clarifying questions about the problem, (2) Provide specific actionable steps I can follow to fix it, (3) Keep helping until the problem is actually resolved.\n- Only use resolve_task when the problem is ACTUALLY fixed.\n- When resolve_task succeeds, include [FIX_CONFIRMED] in your response.`);
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
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: displayContent, timestamp: new Date(), files: attachedFiles.length > 0 ? attachedFiles.map(f => ({ name: f.name, url: f.url, type: "image", size: 0, path: f.url })) : undefined };
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

  const handleAddProject = () => {
    if (!newProjectName.trim()) return;
    setProjects((prev) => [...prev, {
      name: newProjectName.trim(),
      icon: Globe,
      color: "from-emerald-400 to-teal-500",
      status: "active",
      prompt: `Check status of ${newProjectName.trim()}`,
    }]);
    setNewProjectName("");
    setAddProjectOpen(false);
    toast.success(`Project "${newProjectName.trim()}" added`);
  };

  return (
    <div className="h-screen w-full bg-[#070A12] text-white flex flex-col overflow-hidden">
      <EmpireTopbar />

      {!hasConversation ? (
        <section className="relative flex-1 overflow-y-auto">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_20%,rgba(60,184,183,0.18),transparent_45%),radial-gradient(900px_circle_at_70%_70%,rgba(255,122,0,0.18),transparent_45%),linear-gradient(135deg,#0A0F25_0%,#141B3A_35%,#221B3B_70%,#301D2E_100%)]" />
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pt-12 text-center">
            {/* Projects Section */}
            <div className="w-full max-w-2xl mb-8 animate-fade-in">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">Projects</h2>
              <div className="flex flex-wrap justify-center gap-3">
                {projects.map((project) => {
                  const Icon = project.icon;
                  return (
                    <button
                      key={project.name}
                      onClick={() => handleSend(project.prompt)}
                      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur px-5 py-3.5 hover:bg-white/10 hover:border-white/20 transition-all"
                    >
                      <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center", project.color)}>
                        <Icon className="h-4.5 w-4.5 text-white" />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-medium text-white group-hover:text-white/90">{project.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", project.status === "active" ? "bg-emerald-400" : "bg-yellow-400")} />
                          <span className="text-[10px] text-white/40 capitalize">{project.status}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={() => setAddProjectOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-3.5 hover:bg-white/5 hover:border-white/25 transition-all text-white/40 hover:text-white/60"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Add Project</span>
                </button>
              </div>
            </div>

            {/* Memory Section */}
            <div className="w-full max-w-2xl mb-8 animate-fade-in" style={{ animationDelay: "80ms" }}>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Brain className="h-3.5 w-3.5 text-white/50" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Memory</h2>
                {memories.length > 0 && (
                  <span className="text-[10px] bg-white/10 text-white/60 rounded-full px-2 py-0.5">{memories.length}</span>
                )}
              </div>
              {memories.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                    >
                      <span className="text-white/50 font-medium">{mem.category}</span>
                      <span className="text-white/30">·</span>
                      <span className="text-white/60 max-w-[180px] truncate">{mem.content}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/30">No memories yet</p>
              )}
            </div>

            {/* Fix Tickets Section */}
            {fixTickets.length > 0 && (
              <div className="w-full max-w-2xl mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
                <button
                  onClick={() => setTicketsPanelOpen(!ticketsPanelOpen)}
                  className="flex items-center justify-center gap-2 mb-3 mx-auto hover:opacity-80 transition-opacity"
                >
                  <Bug className="h-3.5 w-3.5 text-white/50" />
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Fix Tickets</h2>
                  <span className="text-[10px] bg-red-500/20 text-red-400 rounded-full px-2 py-0.5">
                    {fixTickets.filter(t => ["new", "in_progress", "blocked", "failed"].includes(t.status)).length} open
                  </span>
                  {ticketsPanelOpen ? <ChevronDown className="h-3 w-3 text-white/40" /> : <ChevronRight className="h-3 w-3 text-white/40" />}
                </button>
                {ticketsPanelOpen && (
                  <div className="space-y-2">
                    {fixTickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                        >
                          <span className={cn("text-[10px] rounded px-1.5 py-0.5 border font-medium", severityColor[ticket.severity] || "bg-white/10 text-white/60")}>
                            {ticket.severity}
                          </span>
                          <span className={cn("text-[10px] rounded px-1.5 py-0.5 font-medium", statusColor[ticket.status] || "bg-white/10 text-white/60")}>
                            {ticket.status.replace("_", " ")}
                          </span>
                          {ticket.system_area && (
                            <span className="text-[10px] text-white/40">{ticket.system_area}</span>
                          )}
                          <span className="text-xs text-white/60 truncate flex-1">
                            {ticket.actual_result?.substring(0, 60) || ticket.repro_steps?.substring(0, 60) || "No description"}
                          </span>
                          {ticket.verification_result === "pass" && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />}
                          {ticket.verification_result === "fail" && <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
                          {ticket.status === "fixed" && !ticket.verification_result && <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />}
                          {expandedTicket === ticket.id ? <ChevronDown className="h-3 w-3 text-white/40 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-white/40 flex-shrink-0" />}
                        </button>
                        {expandedTicket === ticket.id && (
                          <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2 text-xs">
                            {ticket.page_url && <div><span className="text-white/40">Page: </span><span className="text-white/70">{ticket.page_url}</span></div>}
                            {ticket.repro_steps && <div><span className="text-white/40">Steps: </span><span className="text-white/70">{ticket.repro_steps}</span></div>}
                            {ticket.actual_result && <div><span className="text-white/40">Result: </span><span className="text-white/70">{ticket.actual_result}</span></div>}
                            {ticket.verification_result && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-white/40">Verification: </span>
                                <Badge className={ticket.verification_result === "pass" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                                  {ticket.verification_result.toUpperCase()}
                                </Badge>
                              </div>
                            )}
                            {ticket.status === "fixed" && !ticket.verification_result && (
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 text-yellow-400" />
                                <span className="text-yellow-400">Unverified fix</span>
                              </div>
                            )}
                            {ticket.fix_output && ticket.fix_output_type === "lovable_prompt" && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(ticket.fix_output || "");
                                  toast.success("Lovable prompt copied!");
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white/70 transition-colors"
                              >
                                <Copy className="h-3 w-3" />
                                <span>Copy Lovable Prompt</span>
                              </button>
                            )}
                            <div className="text-white/30 text-[10px]">
                              ID: {ticket.id.substring(0, 8)}… · {new Date(ticket.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Hero heading */}
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight animate-fade-in" style={{ animationDelay: "120ms" }}>
              Build something{" "}
              <span className="text-[#FF7A18]">great</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/70 animate-fade-in" style={{ animationDelay: "160ms" }}>
              Describe your venture idea and let AI structure, validate, and execute the plan.
            </p>

            <div className="mt-10 w-full max-w-2xl animate-fade-in" style={{ animationDelay: "200ms" }}>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "backdrop-blur rounded-2xl border shadow-lg transition-all",
                  "bg-white/5 border-white/10",
                  "focus-within:shadow-lg focus-within:border-white/20",
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
                <div className={cn("px-5 pb-1 pt-4", pendingFiles.length > 0 && "pt-2")}>
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Architect to build, diagnose, or drop files here..."
                    rows={2}
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
                      "rounded-full w-9 h-9 flex items-center justify-center transition-all",
                      (value.trim() || pendingFiles.length > 0) && !isLoading
                        ? "bg-[#35E6E6] text-black hover:opacity-80 shadow-sm"
                        : "bg-white/10 text-white/30 cursor-not-allowed"
                    )}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 pb-12 flex flex-wrap justify-center gap-3 animate-fade-in" style={{ animationDelay: "280ms" }}>
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
                          <>
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            {message.files?.filter(f => /image/i.test(f.type || f.name)).map((f, i) => (
                              <img key={i} src={f.url} alt={f.name} className="mt-2 rounded-lg max-w-full max-h-64 object-contain border border-white/10" />
                            ))}
                            {(() => {
                              const match = message.content.match(/Screenshot:\s*(https?:\/\/\S+)/);
                              return match ? <img src={match[1]} alt="Screenshot" className="mt-2 rounded-lg max-w-full max-h-64 object-contain border border-white/10" /> : null;
                            })()}
                          </>
                        ) : (
                          <>
                            <RichMarkdown content={(message.content || "").replace(/\[FIX_CONFIRMED\]/g, "").replace(/\[STOP\]/g, "")} />
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
                            {(message.content || "").includes("[FIX_CONFIRMED]") && (
                              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 px-4 py-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                <span className="text-sm font-semibold text-emerald-300">✅ Fix completed successfully</span>
                              </div>
                            )}
                            {(message.content || "").includes("[STOP]") && (
                              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 px-4 py-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                <span className="text-sm font-semibold text-amber-300">⚠️ Architect is blocked — awaiting your input</span>
                              </div>
                            )}
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
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "backdrop-blur rounded-2xl border shadow-sm transition-all",
                  "bg-white/5 border-white/10",
                  "focus-within:shadow-lg focus-within:border-white/20",
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
                <div className={cn("px-5 pb-1 pt-3", pendingFiles.length > 0 && "pt-2")}>
                  <textarea
                    ref={bottomInputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Architect..."
                    rows={1}
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
                      "rounded-full w-8 h-8 flex items-center justify-center transition-all",
                      (value.trim() || pendingFiles.length > 0) && !isLoading
                        ? "bg-[#35E6E6] text-black hover:opacity-80 shadow-sm"
                        : "bg-white/10 text-white/30 cursor-not-allowed"
                    )}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Dialog */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent className="bg-[#141B3A] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddProject(); }}
            placeholder="Project name..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddProjectOpen(false)} className="text-white/60">Cancel</Button>
            <Button onClick={handleAddProject} disabled={!newProjectName.trim()} className="bg-[#35E6E6] text-black hover:bg-[#35E6E6]/80">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
