import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, User, UserCheck, CheckCircle, MessageSquare, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  metadata: any;
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
  const [profileId, setProfileId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Get profile ID
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setProfileId(data.id);
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
        setMessages((prev) => [...prev, payload.new as Message]);
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

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm">Select a conversation to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      {convo && (
        <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{convo.visitor_name || "Visitor"}</p>
              {convo.visitor_email && <p className="text-xs text-muted-foreground">{convo.visitor_email}</p>}
            </div>
            <Badge variant="outline" className="text-[10px]">{convo.status}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {!convo.assigned_to && (
              <Button variant="outline" size="sm" onClick={assignToMe} className="text-xs gap-1">
                <UserCheck className="w-3 h-3" /> Assign to me
              </Button>
            )}
            <Select value={convo.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-28 h-8 text-xs">
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
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {messages.map((msg) => {
            if (msg.content_type === "system") {
              return (
                <div key={msg.id} className="text-center text-[10px] text-muted-foreground/50 py-1">
                  {msg.content} · {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </div>
              );
            }

            const isAgent = msg.sender_type === "agent";
            return (
              <div key={msg.id} className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                  msg.is_internal_note
                    ? "bg-accent/50 border border-accent text-accent-foreground"
                    : isAgent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                )}>
                  {msg.is_internal_note && (
                    <div className="flex items-center gap-1 text-[10px] font-medium mb-1 text-accent-foreground/70">
                      <StickyNote className="w-3 h-3" /> Internal Note
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn(
                    "text-[10px] mt-1",
                    isAgent ? "text-primary-foreground/60" : "text-muted-foreground/60"
                  )}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsNote(false)}
            className={cn(
              "text-xs px-2 py-1 rounded-md transition-colors",
              !isNote ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Reply
          </button>
          <button
            onClick={() => setIsNote(true)}
            className={cn(
              "text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1",
              isNote ? "bg-accent/50 text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <StickyNote className="w-3 h-3" /> Note
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={isNote ? "Add an internal note..." : "Type your reply..."}
            className="flex-1 min-h-[40px] max-h-[100px] text-sm resize-none bg-secondary rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
            rows={1}
          />
          <Button size="sm" onClick={sendMessage} disabled={!input.trim() || sending} className="self-end gap-1">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
