import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { User, Clock, MapPin } from "lucide-react";
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
  metadata: any;
}

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function getPresenceStatus(metadata: any): "online" | "away" | "offline" {
  if (!metadata?.last_seen_at) return "offline";
  const lastSeen = new Date(metadata.last_seen_at).getTime();
  const now = Date.now();
  const diffSec = (now - lastSeen) / 1000;
  if (diffSec < 60) return "online";
  if (diffSec < 300) return "away";
  return "offline";
}

export function SupportConversationList({ selectedId, onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    let query = supabase
      .from("support_conversations")
      .select("id, visitor_name, visitor_email, status, last_message_at, created_at, assigned_to, tags, metadata")
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
      .channel("support-convos-list-" + Math.random().toString(36).slice(2, 8))
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  // Refresh presence every 30s
  useEffect(() => {
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
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

  const presenceDotColor = (status: "online" | "away" | "offline") => {
    switch (status) {
      case "online": return "bg-green-500";
      case "away": return "bg-yellow-500";
      case "offline": return "bg-muted-foreground/30";
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
          conversations.map((c) => {
            const presence = getPresenceStatus(c.metadata);
            const city = c.metadata?.city;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                  selectedId === c.id && "bg-muted"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className={cn("w-2 h-2 rounded-full", presenceDotColor(presence))} />
                    </div>
                    <span className="text-sm font-medium truncate">{c.visitor_name || "Visitor"}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColor(c.status))}>
                    {c.status}
                  </Badge>
                </div>
                {c.visitor_email && (
                  <p className="text-xs text-muted-foreground truncate pl-4">{c.visitor_email}</p>
                )}
                <div className="flex items-center gap-2 mt-1 pl-4">
                  {city && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                      <MapPin className="w-2.5 h-2.5" />
                      {city}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                    <Clock className="w-3 h-3" />
                    {c.last_message_at
                      ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })
                      : formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
