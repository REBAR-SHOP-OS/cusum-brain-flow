import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Send, User, UserCheck, MessageSquare, StickyNote, Sparkles, Loader2, MapPin, Globe, ExternalLink, Paperclip, Download, Copy, Check, Clock3, ShieldCheck, Orbit, Mail, Wand2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { playMockingjayWhistle } from "@/lib/notificationSound";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  content_type: string;
  is_internal_note: boolean;
  created_at: string;
}

interface ConvoDetails {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  metadata: {
    last_seen_at?: string;
    city?: string;
    country?: string;
    current_page?: string;
  } | null;
}

interface Props {
  conversationId: string | null;
}

export function SupportChatView({ conversationId }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [convo, setConvo] = useState<ConvoDetails | null>(null);
  const [input, setInput] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const assigneeName = useMemo(() => {
    if (!convo?.assigned_to) return "Unassigned";
    return teamMembers.find((member) => member.id === convo.assigned_to)?.full_name || "Assigned teammate";
  }, [convo?.assigned_to, teamMembers]);

  const messageStats = useMemo(() => {
    const visitorMessages = messages.filter((msg) => msg.sender_type === "visitor" && !msg.is_internal_note).length;
    const agentMessages = messages.filter((msg) => msg.sender_type === "agent" && !msg.is_internal_note).length;
    const internalNotes = messages.filter((msg) => msg.is_internal_note).length;

    return {
      total: messages.length,
      visitorMessages,
      agentMessages,
      internalNotes,
    };
  }, [messages]);

  const currentPresence = useMemo(() => {
    const lastSeen = convo?.metadata?.last_seen_at;
    if (!lastSeen) return { label: "Offline", color: "bg-muted-foreground/30" };

    const diffSec = (Date.now() - new Date(lastSeen).getTime()) / 1000;
    if (diffSec < 60) return { label: "Live now", color: "bg-emerald-500" };
    if (diffSec < 300) return { label: "Recently active", color: "bg-amber-400" };
    return { label: "Offline", color: "bg-muted-foreground/30" };
  }, [convo?.metadata?.last_seen_at]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) {
      setConvo(null);
      setMessages([]);
      return;
    }

    const [conversationResult, messagesResult] = await Promise.all([
      supabase
        .from("support_conversations")
        .select("id, visitor_name, visitor_email, status, assigned_to, created_at, metadata")
        .eq("id", conversationId)
        .single(),
      supabase
        .from("support_messages")
        .select("id, sender_type, sender_id, content, content_type, is_internal_note, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

    if (conversationResult.data) {
      setConvo(conversationResult.data as ConvoDetails);
    }
    setMessages((messagesResult.data as Message[]) || []);
  }, [conversationId]);

  // Get profile ID + team members
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id, company_id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfileId(data.id);
        // Fetch all team members for this company
        supabase.from("profiles").select("id, full_name").eq("company_id", data.company_id).order("full_name").then(({ data: members }) => {
          if (members) setTeamMembers(members);
        });
      }
    });
  }, [user]);

  // Fetch conversation details
  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Real-time messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`support-msgs-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
        // Push notifications are now handled server-side via notify-on-message.
        // Only play local sound if this is a visitor message and the tab is focused.
        if (msg.sender_type === "visitor" && document.hasFocus()) {
          playMockingjayWhistle();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !conversationId || !profileId || sending) return;

    setSending(true);
    setInput("");

    const { error } = await supabase.from("support_messages").insert({
      conversation_id: conversationId,
      sender_type: "agent",
      sender_id: profileId,
      content: text,
      is_internal_note: isNote,
    });

    if (error) {
      toast.error("Failed to send message");
      setInput(text);
    }
    setSending(false);
  };

  const updateStatus = async (status: string) => {
    if (!conversationId) return;
    const { error } = await supabase
      .from("support_conversations")
      .update({
        status,
        ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
      })
      .eq("id", conversationId);

    if (error) toast.error("Failed to update status");
    else {
      toast.success(`Conversation ${status}`);
      setConvo((prev) => prev ? { ...prev, status } : null);
    }
  };

  const assignToMe = async () => {
    if (!conversationId || !profileId) return;
    const { error } = await supabase
      .from("support_conversations")
      .update({ assigned_to: profileId, status: "assigned" })
      .eq("id", conversationId);

    if (error) toast.error("Failed to assign");
    else {
      toast.success("Assigned to you");
      setConvo((prev) => prev ? { ...prev, assigned_to: profileId, status: "assigned" } : null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !profileId) return;
    if (!file.type.startsWith("image/")) { toast.error("Only images are supported"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await uploadToStorage("support-attachments", path, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("support-attachments").getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      const { error } = await supabase.from("support_messages").insert({
        conversation_id: conversationId,
        sender_type: "agent",
        sender_id: profileId,
        content: imageUrl,
        content_type: "image",
        is_internal_note: false,
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error("Failed to upload image");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCopyText = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error("Failed to copy"); }
  };

  const handleDownloadImage = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() || "image.png";
    a.target = "_blank";
    a.click();
  };

  const suggestReply = async () => {
    if (!conversationId || suggesting) return;
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-suggest", {
        body: { conversation_id: conversationId },
      });
      if (error) throw error;
      if (data?.suggestion) {
        setInput(data.suggestion);
        setIsNote(false);
        toast.success("Suggestion loaded — review and send");
      } else {
        toast.info("No suggestion generated");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to get suggestion");
    } finally {
      setSuggesting(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-[28px] border border-border/70 bg-card/80 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <MessageSquare className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Open a conversation to start assisting</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pick any visitor thread from the inbox to review context, collaborate with notes, and reply with AI-assisted drafts.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-left text-xs text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
              <p className="font-medium text-foreground">Context</p>
              <p className="mt-1">Location, page, and timeline.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
              <p className="font-medium text-foreground">Reply</p>
              <p className="mt-1">Fast human or AI-assisted response.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
              <p className="font-medium text-foreground">Track</p>
              <p className="mt-1">Internal notes and status changes.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
      {convo && (
        <div className="border-b border-border/70 bg-gradient-to-r from-background via-background to-primary/5 px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative mt-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background", currentPresence.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {convo.visitor_name || "Visitor"}
                  </h2>
                  <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    {convo.status}
                  </Badge>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", currentPresence.color)} />
                    {currentPresence.label}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {convo.visitor_email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-primary" />
                      {convo.visitor_email}
                    </span>
                  )}
                  {(convo.metadata?.city || convo.metadata?.country) && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      {[convo.metadata?.city, convo.metadata?.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4 text-primary" />
                    Started {formatDistanceToNow(new Date(convo.created_at), { addSuffix: true })}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Coverage
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{messageStats.total}</p>
                    <p className="text-xs text-muted-foreground">Messages in the active thread.</p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      <Orbit className="h-3.5 w-3.5 text-primary" />
                      Assignment
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{assigneeName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Current owner of the conversation.</p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      <StickyNote className="h-3.5 w-3.5 text-primary" />
                      Notes
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{messageStats.internalNotes}</p>
                    <p className="text-xs text-muted-foreground">Internal notes captured for handoff.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-[280px]">
              <div className="rounded-3xl border border-border/70 bg-background/80 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Routing
                </p>
                <div className="space-y-2">
                  <Select
                    value={convo.assigned_to || "__unassigned__"}
                    onValueChange={async (val) => {
                      const assignee = val === "__unassigned__" ? null : val;
                      const { error } = await supabase
                        .from("support_conversations")
                        .update({ assigned_to: assignee, status: assignee ? "assigned" : "open" })
                        .eq("id", conversationId);
                      if (error) toast.error("Failed to assign");
                      else {
                        const name = teamMembers.find((m) => m.id === assignee)?.full_name || "Unassigned";
                        toast.success(assignee ? `Assigned to ${name}` : "Unassigned");
                        setConvo((prev) => prev ? { ...prev, assigned_to: assignee, status: assignee ? "assigned" : "open" } : null);
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background text-sm">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <SelectValue placeholder="Assign to..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || "Unknown"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={convo.status} onValueChange={updateStatus}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!convo.assigned_to && (
                  <Button variant="outline" className="mt-3 h-10 w-full rounded-2xl border-border/70" onClick={assignToMe}>
                    Assign to me
                  </Button>
                )}
              </div>

              {convo.metadata?.current_page && (
                <div className="rounded-3xl border border-border/70 bg-background/80 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Visitor page
                  </p>
                  <a
                    href={convo.metadata.current_page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-2xl border border-primary/15 bg-primary/5 p-3 transition-colors hover:border-primary/30 hover:bg-primary/10"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Globe className="h-4 w-4 text-primary" />
                      Live page context
                      <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {convo.metadata.current_page.replace(/^https?:\/\//, "")}
                    </p>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 bg-muted/20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Visitor messages</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{messageStats.visitorMessages}</p>
              <p className="text-xs text-muted-foreground">Messages received from the customer.</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Agent replies</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{messageStats.agentMessages}</p>
              <p className="text-xs text-muted-foreground">Replies already sent from the ERP.</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Status</p>
              <p className="mt-2 text-sm font-semibold capitalize text-foreground">{convo?.status || "Open"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Keep the workflow updated for teammates.</p>
            </div>
          </div>

          {messages.map((msg) => {
            if (msg.content_type === "system") {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] text-muted-foreground">
                    {msg.content} · {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </div>
                </div>
              );
            }

            const isAgent = msg.sender_type === "agent";
            const bubbleTone = msg.is_internal_note
              ? "border-amber-500/20 bg-amber-500/10 text-foreground"
              : isAgent
                ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_16px_30px_-20px_hsl(var(--primary))]"
                : "border-border/70 bg-background text-foreground";

            const actionTone = msg.is_internal_note
              ? "text-foreground/70 hover:bg-amber-500/10 hover:text-foreground"
              : isAgent
                ? "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground";

            return (
              <div key={msg.id} className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
                <div className={cn("w-full max-w-[85%] rounded-[28px] border px-4 py-4", bubbleTone)}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-2xl border text-xs font-semibold",
                          msg.is_internal_note
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                            : isAgent
                              ? "border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground"
                              : "border-border/60 bg-muted text-foreground"
                        )}
                      >
                        {msg.is_internal_note ? <StickyNote className="h-4 w-4" /> : isAgent ? "RS" : <User className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className={cn("text-sm font-medium", isAgent && !msg.is_internal_note ? "text-primary-foreground" : "text-foreground")}>
                          {msg.is_internal_note ? "Internal note" : isAgent ? "Support agent" : convo?.visitor_name || "Visitor"}
                        </p>
                        <p className={cn("text-[11px]", isAgent && !msg.is_internal_note ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {msg.content_type === "image" && (
                      <div className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]", isAgent ? "bg-primary-foreground/10 text-primary-foreground/80" : "bg-muted text-muted-foreground")}>
                        <ImageIcon className="h-3.5 w-3.5" />
                        Image
                      </div>
                    )}
                  </div>
                  {msg.content_type === "image" ? (
                    <div>
                      <img
                        src={msg.content}
                        alt="Shared image"
                        className="max-h-[320px] w-full rounded-3xl border border-black/5 object-cover"
                        onClick={() => window.open(msg.content, "_blank")}
                      />
                      <button
                        onClick={() => handleDownloadImage(msg.content)}
                        className={cn("mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors", actionTone)}
                      >
                        <Download className="h-3.5 w-3.5" /> Download image
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="whitespace-pre-wrap text-sm leading-7">{msg.content}</p>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className={cn("mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors", actionTone)}
                      >
                        {copiedId === msg.id ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy text</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 bg-background/95 p-4 md:p-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsNote(false)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                !isNote ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "border border-border/70 bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Reply to visitor
            </button>
            <button
              onClick={() => setIsNote(true)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isNote ? "bg-amber-500/15 text-amber-700 dark:text-amber-200" : "border border-border/70 bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <StickyNote className="h-3.5 w-3.5" />
              Internal note
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={suggestReply}
                disabled={suggesting}
                className="h-9 rounded-full border border-primary/20 bg-primary/5 px-4 text-xs text-primary hover:bg-primary/10"
              >
                {suggesting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
                {suggesting ? "Generating..." : "Suggest reply"}
              </Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-border/70 bg-card/90 p-3 shadow-sm">
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-10 w-10 shrink-0 rounded-2xl border border-border/70 bg-background p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <div className="flex-1">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={isNote ? "Capture context, action items, or follow-up notes..." : "Write a polished reply to the visitor..."}
                  className="min-h-[120px] resize-none rounded-[24px] border-none bg-muted/40 px-4 py-3 text-sm leading-6 shadow-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  rows={4}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/70 bg-background px-3 py-1">
                      Enter to send
                    </span>
                    <span className="rounded-full border border-border/70 bg-background px-3 py-1">
                      Shift + Enter for new line
                    </span>
                    {isNote && (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-200">
                        Visible to teammates only
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="h-11 rounded-2xl px-5"
                  >
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {isNote ? "Save note" : "Send reply"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
