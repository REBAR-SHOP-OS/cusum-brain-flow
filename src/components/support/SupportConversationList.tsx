import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Clock3,
  Globe,
  Inbox,
  MapPin,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
    setLoading(true);
    let query = supabase
      .from("support_conversations")
      .select("id, visitor_name, visitor_email, status, last_message_at, created_at, assigned_to, tags, metadata")
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (companyId) query = query.eq("company_id", companyId);
    if (filter === "open") query = query.in("status", ["open", "assigned", "pending"]);
    if (filter === "resolved") query = query.in("status", ["resolved", "closed"]);

    const { data } = await query;
    setConversations((data as Conversation[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!companyId) return;
    fetchConversations();
  }, [filter, companyId]);

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
  }, [filter, companyId]);

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
    const term = search.trim().toLowerCase();
    if (!term) return conversations;

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.visitor_name,
        conversation.visitor_email,
        conversation.status,
        conversation.metadata?.city,
        conversation.metadata?.country,
        conversation.metadata?.current_page,
        ...(conversation.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [conversations, search]);

  const queueStats = useMemo(() => {
    const open = conversations.filter((conversation) =>
      ["open", "assigned", "pending"].includes(conversation.status)
    ).length;
    const live = conversations.filter(
      (conversation) => getPresenceStatus(conversation.metadata) === "online"
    ).length;
    const assigned = conversations.filter((conversation) => conversation.assigned_to).length;

    return { open, live, assigned, total: conversations.length };
  }, [conversations]);

  return (
    <div className="flex w-[360px] shrink-0 flex-col border-r border-border/60 bg-muted/20 xl:w-[390px]">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                Conversation queue
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Triage faster
              </h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Open</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{queueStats.open}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Live</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{queueStats.live}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assigned</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{queueStats.assigned}</p>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search visitor, email, location, or page"
              className="h-11 w-full rounded-2xl border border-border/70 bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div className="mt-4 flex rounded-2xl bg-muted/60 p-1">
            {(["all", "open", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 rounded-2xl px-3 py-2 text-xs font-medium capitalize transition-all",
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
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {filteredConversations.length} conversation{filteredConversations.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted-foreground">
            {queueStats.total} total in this workspace
          </p>
        </div>
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-wide text-primary">
          Live queue
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="space-y-3 px-1 py-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-3xl border border-border/60 bg-background/80 p-4">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="mt-3 h-3 w-40 rounded bg-muted" />
                <div className="mt-2 h-3 w-28 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              No conversations match this view
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Install the website widget or broaden the filters to see more visitor chats.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conversation) => {
              const presence = getPresenceStatus(conversation.metadata);
              const city = conversation.metadata?.city;
              const currentPage = conversation.metadata?.current_page;
              const currentHost = typeof currentPage === "string"
                ? currentPage.replace(/^https?:\/\//, "").split("/")[0]
                : null;

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    "group w-full rounded-3xl border p-4 text-left transition-all",
                    selectedId === conversation.id
                      ? "border-primary/25 bg-primary/10 shadow-[0_16px_40px_rgba(45,212,191,0.14)]"
                      : "border-border/60 bg-background/85 hover:border-primary/15 hover:bg-background hover:shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                        {(conversation.visitor_name || "Visitor").slice(0, 2).toUpperCase()}
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                            presenceDotColor(presence)
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {conversation.visitor_name || "Visitor"}
                          </p>
                          {conversation.assigned_to && (
                            <Badge variant="outline" className="rounded-full border-blue-500/20 bg-blue-500/10 px-2 py-0 text-[10px] text-blue-600">
                              Assigned
                            </Badge>
                          )}
                        </div>
                        {conversation.visitor_email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {conversation.visitor_email}
                          </p>
                        )}
                      </div>
                    </div>

                    <Badge variant="outline" className={cn("rounded-full border px-2.5 py-1 text-[10px] capitalize", statusColor(conversation.status))}>
                      {conversation.status}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {city && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                        <MapPin className="h-3 w-3" />
                        {city}
                      </span>
                    )}
                    {currentHost && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                        <Globe className="h-3 w-3" />
                        {currentHost}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                      <Clock3 className="h-3 w-3" />
                      {conversation.last_message_at
                        ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
                        : formatDistanceToNow(new Date(conversation.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {!!conversation.tags?.length && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {conversation.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
