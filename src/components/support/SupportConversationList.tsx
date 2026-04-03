import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { User, Clock, MapPin, Search, Sparkles, Filter, Inbox, Globe, UserCheck } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { companyId } = useCompanyId();

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
      .on("postgres_changes", {
        event: "*", schema: "public", table: "support_conversations",
        ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter, companyId]);

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

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [conversation.visitor_name, conversation.visitor_email, conversation.metadata?.city, conversation.metadata?.country, ...(conversation.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [conversations, search]);

  const queueSummary = useMemo(() => {
    const open = conversations.filter((conversation) => ["open", "assigned", "pending"].includes(conversation.status)).length;
    const resolved = conversations.filter((conversation) => ["resolved", "closed"].includes(conversation.status)).length;
    const online = conversations.filter((conversation) => getPresenceStatus(conversation.metadata) === "online").length;
    return { total: conversations.length, open, resolved, online };
  }, [conversations]);

  return (
    <div className="flex w-full shrink-0 flex-col border-r border-border/70 bg-card/70 backdrop-blur xl:w-[390px]">
      <div className="border-b border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI triage queue
            </div>
            <h3 className="mt-3 text-lg font-semibold text-foreground">Conversation inbox</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Track live website chats, prioritize hot leads, and keep every visitor routed.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-3 text-right shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Active now</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{queueSummary.online}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Open", value: queueSummary.open, icon: Inbox },
            { label: "Resolved", value: queueSummary.resolved, icon: Filter },
            { label: "Total", value: queueSummary.total, icon: Globe },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border/60 bg-background/70 p-3">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] uppercase tracking-[0.24em]">{item.label}</span>
                <item.icon className="h-3.5 w-3.5" />
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search visitor, email, city, tag..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-4 flex gap-2 rounded-2xl bg-muted/60 p-1">
          {(["all", "open", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-xs font-medium capitalize transition-all",
                filter === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/60 p-8 text-center text-sm text-muted-foreground">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 p-8 text-center">
            <User className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{search ? "No matches found" : "No conversations yet"}</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {search ? "Try a different keyword or clear the search." : "Install the widget to start receiving chats."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
          {filteredConversations.map((c) => {
            const presence = getPresenceStatus(c.metadata);
            const city = c.metadata?.city;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full rounded-3xl border px-4 py-4 text-left transition-all",
                  selectedId === c.id
                    ? "border-primary/30 bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-border/60 bg-background/80 hover:border-primary/20 hover:bg-muted/40"
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-muted/60">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className={cn("absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full ring-2 ring-background", presenceDotColor(presence))} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{c.visitor_name || "Visitor"}</div>
                      {c.visitor_email && (
                        <p className="truncate text-xs text-muted-foreground">{c.visitor_email}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full border px-2 py-1 text-[10px] font-medium capitalize", statusColor(c.status))}>
                    {c.status}
                  </Badge>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {city && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {city}
                    </span>
                  )}
                  {c.metadata?.current_page && (
                    <span className="inline-flex max-w-[180px] items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                      <Globe className="h-3 w-3 shrink-0" />
                      <span className="truncate">{String(c.metadata.current_page).replace(/^https?:\/\//, "")}</span>
                    </span>
                  )}
                  {c.assigned_to && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                      <UserCheck className="h-3 w-3" />
                      Assigned
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <Clock className="h-3 w-3" />
                    {c.last_message_at
                      ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })
                      : formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                  {c.tags?.length ? (
                    <div className="flex items-center gap-1">
                      {c.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
