import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bot,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  StickyNote,
  User,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { playMockingjayWhistle } from "@/lib/notificationSound";

interface Message {
  id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  content_type: string | null;
  is_internal_note: boolean | null;
  created_at: string;
}

interface ConvoDetails {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  metadata: any;
}

interface Props {
  conversationId: string | null;
}

function getPresenceStatus(metadata: any): "online" | "away" | "offline" {
  if (!metadata?.last_seen_at) return "offline";
  const diffSec = (Date.now() - new Date(metadata.last_seen_at).getTime()) / 1000;
  if (diffSec < 60) return "online";
  if (diffSec < 300) return "away";
  return "offline";
}

function getPresenceDot(status: "online" | "away" | "offline") {
  switch (status) {
    case "online":
      return "bg-emerald-500";
    case "away":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground/30";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "open":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
    case "assigned":
      return "border-blue-500/20 bg-blue-500/10 text-blue-600";
    case "pending":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600";
    case "resolved":
      return "border-border/70 bg-muted text-muted-foreground";
    case "closed":
      return "border-border/70 bg-muted text-muted-foreground";
    default:
      return "border-border/70 bg-muted text-muted-foreground";
  }
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
    if (!conversationId) { setConvo(null); setMessages([]); return; }

    supabase
      .from("support_conversations")
      .select("id, visitor_name, visitor_email, status, assigned_to, created_at, metadata")
      .eq("id", conversationId)
      .single()
      .then(({ data }) => { if (data) setConvo(data as ConvoDetails); });

    supabase
      .from("support_messages")
      .select("id, sender_type, sender_id, content, content_type, is_internal_note, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => { setMessages((data as Message[]) || []); });
  }, [conversationId]);

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

  const presence = convo ? getPresenceStatus(convo.metadata) : "offline";
  const currentPage = convo?.metadata?.current_page;
  const currentPageLabel =
    typeof currentPage === "string" ? currentPage.replace(/^https?:\/\//, "") : null;
  const visitorLocation = convo?.metadata?.city
    ? `${convo.metadata.city}${convo.metadata.country ? `, ${convo.metadata.country}` : ""}`
    : convo?.metadata?.country || null;
  const assigneeName = useMemo(() => {
    if (!convo?.assigned_to) return "Unassigned";
    return teamMembers.find((member) => member.id === convo.assigned_to)?.full_name || "Assigned";
  }, [convo?.assigned_to, teamMembers]);
  const visitorInitials = ((convo?.visitor_name || "Visitor")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("") || "V").toUpperCase();

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
    } catch (err: any) {
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
    } catch (e: any) {
      toast.error(e.message || "Failed to get suggestion");
    } finally {
      setSuggesting(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.10),transparent_28%),transparent] p-6">
        <div className="max-w-md rounded-[32px] border border-border/60 bg-background/85 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-primary/10 text-primary">
            <MessageSquare className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-foreground">Select a conversation</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pick a visitor from the queue to see live context, AI reply suggestions, and modern agent controls.
          </p>
          <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
            {[
              "Review visitor context instantly",
              "Draft replies with AI",
              "Switch between notes and replies",
              "Share images without leaving the inbox",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {convo && (
        <div className="border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-primary/10 text-base font-semibold text-primary">
                  {visitorInitials}
                  <span
                    className={cn(
                      "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-background",
                      getPresenceDot(presence)
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold tracking-tight text-foreground">
                      {convo.visitor_name || "Visitor"}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn("rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide", getStatusBadge(convo.status))}
                    >
                      {convo.status}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {assigneeName}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {convo.visitor_email && <span>{convo.visitor_email}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Started {formatDistanceToNow(new Date(convo.created_at), { addSuffix: true })}
                    </span>
                    <span className="inline-flex items-center gap-1 capitalize">
                      <span className={cn("h-2 w-2 rounded-full", getPresenceDot(presence))} />
                      {presence}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {visitorLocation && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {visitorLocation}
                      </span>
                    )}
                    {currentPageLabel && (
                      <a
                        href={currentPage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
                      >
                        <Globe className="h-3 w-3" />
                        <span className="max-w-[260px] truncate">{currentPageLabel}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
                      <Bot className="h-3 w-3" />
                      AI reply suggestions ready
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {profileId && convo.assigned_to !== profileId && (
                <Button variant="outline" size="sm" className="h-10 rounded-2xl px-4" onClick={assignToMe}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Assign to me
                </Button>
              )}
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
                <SelectTrigger className="h-10 min-w-[180px] rounded-2xl border-border/70 bg-background text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5" />
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
                <SelectTrigger className="h-10 min-w-[140px] rounded-2xl border-border/70 bg-background text-xs">
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
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.06),transparent_24%),radial-gradient(circle_at_bottom,rgba(45,212,191,0.08),transparent_28%),transparent]">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
          {messages.map((msg) => {
            if (msg.content_type === "system") {
              return (
                <div key={msg.id} className="py-1 text-center text-[10px] text-muted-foreground/60">
                  {msg.content} · {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </div>
              );
            }

            const isAgent = msg.sender_type === "agent";
            return (
              <div key={msg.id} className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[78%]", isAgent ? "items-end" : "items-start")}>
                  <div className={cn("mb-1 flex items-center gap-2 px-1 text-[11px]", isAgent ? "justify-end text-right" : "justify-start")}>
                    <span className="font-medium text-foreground/80">
                      {msg.is_internal_note ? "Internal note" : isAgent ? "You" : convo?.visitor_name || "Visitor"}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "rounded-[24px] border px-4 py-3 text-sm shadow-sm",
                      msg.is_internal_note
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                        : isAgent
                          ? "border-primary/20 bg-primary text-primary-foreground"
                          : "border-border/60 bg-background/90 text-foreground"
                    )}
                  >
                    {msg.is_internal_note && (
                      <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        <StickyNote className="h-3 w-3" />
                        Internal note
                      </div>
                    )}
                    {msg.content_type === "image" ? (
                      <div>
                        <img
                          src={msg.content}
                          alt="Shared image"
                          className="max-h-[280px] max-w-[240px] rounded-2xl border border-border/60 object-cover shadow-sm"
                          onClick={() => window.open(msg.content, "_blank")}
                        />
                        <button
                          onClick={() => handleDownloadImage(msg.content)}
                          className={cn(
                            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors",
                            isAgent
                              ? "bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="whitespace-pre-wrap leading-6">{msg.content}</p>
                        <button
                          onClick={() => handleCopyText(msg.id, msg.content)}
                          className={cn(
                            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors",
                            isAgent
                              ? "bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {isStreaming && (
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-[24px] border border-primary/20 bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending reply...
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 bg-background/90 p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-border/60 bg-background/85 p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNote(false)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  !isNote
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                Reply
              </button>
              <button
                onClick={() => setIsNote(true)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isNote
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-200"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <StickyNote className="h-3 w-3" />
                Internal note
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={suggestReply}
              disabled={suggesting}
              className="h-9 rounded-full px-4 text-xs text-primary"
            >
              {suggesting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
              {suggesting ? "Thinking..." : "Suggest reply"}
            </Button>
          </div>

          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-12 w-12 shrink-0 rounded-2xl p-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>

            <div className="flex-1 rounded-[24px] border border-border/70 bg-muted/30 px-3 py-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isNote ? "Add internal guidance for the team..." : "Write a clear reply to the visitor..."}
                className="min-h-[72px] w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                rows={3}
              />
              <div className="mt-2 flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {isNote
                    ? "Notes stay internal and are never sent to the visitor."
                    : "Press Enter to send quickly. Use Shift+Enter for a new line."}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  AI-powered support workflow
                </span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="h-12 shrink-0 rounded-2xl px-4"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
