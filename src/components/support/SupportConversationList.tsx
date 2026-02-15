import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
  assigned_to: string | null;
  tags: string[];
}

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SupportConversationList({ selectedId, onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    let query = supabase
      .from("support_conversations")
      .select("id, visitor_name, visitor_email, status, last_message_at, created_at, assigned_to, tags")
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (filter === "open") query = query.in("status", ["open", "assigned", "pending"]);
    if (filter === "resolved") query = query.in("status", ["resolved", "closed"]);

    const { data } = await query;
    setConversations((data as Conversation[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("support-convos-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const statusColor = (s: string) => {
    switch (s) {
      case "open": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "assigned": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "pending": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "resolved": return "bg-muted text-muted-foreground";
      case "closed": return "bg-muted text-muted-foreground";
      default: return "";
    }
  };

  return (
    <div className="w-72 xl:w-80 shrink-0 border-r border-border flex flex-col bg-background">
      {/* Filter tabs */}
      <div className="flex border-b border-border">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
              filter === f ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <User className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Install the widget to start receiving chats</p>
          </div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                selectedId === c.id && "bg-muted"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">{c.visitor_name || "Visitor"}</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColor(c.status))}>
                  {c.status}
                </Badge>
              </div>
              {c.visitor_email && (
                <p className="text-xs text-muted-foreground truncate">{c.visitor_email}</p>
              )}
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/60">
                <Clock className="w-3 h-3" />
                {c.last_message_at
                  ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })
                  : formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
