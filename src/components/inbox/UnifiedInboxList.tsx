import { useState } from "react";
import { Mail, Phone, MessageSquare, RefreshCw, Search, Circle, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Communication } from "@/hooks/useCommunications";

interface UnifiedInboxListProps {
  communications: Communication[];
  loading: boolean;
  error: string | null;
  selectedId?: string;
  onSelect: (comm: Communication) => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
}

function parseDisplayName(raw: string): string {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) return match[1] || match[2];
  return raw;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function TypeIcon({ comm }: { comm: Communication }) {
  if (comm.type === "sms") {
    return <MessageSquare className="w-4 h-4 text-green-500" />;
  }
  if (comm.type === "call") {
    return comm.direction === "inbound" 
      ? <PhoneIncoming className="w-4 h-4 text-blue-500" />
      : <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
  }
  return <Mail className="w-4 h-4 text-primary" />;
}

function SourceBadge({ source, type }: { source: string; type: string }) {
  if (source === "ringcentral") {
    return (
      <span className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
        type === "sms" ? "bg-green-500/15 text-green-500" : "bg-blue-500/15 text-blue-500"
      )}>
        {type === "sms" ? "SMS" : "Call"}
      </span>
    );
  }
  return null;
}

export function UnifiedInboxList({
  communications,
  loading,
  error,
  selectedId,
  onSelect,
  onRefresh,
  onSearchChange,
}: UnifiedInboxListProps) {
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(search);
  };

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span className="font-semibold">All Communications</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search emails, calls, SMS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-secondary border-0"
          />
        </form>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && communications.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : error && communications.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Retry
            </Button>
          </div>
        ) : communications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No communications found
          </div>
        ) : (
          communications.map((comm) => {
            const isSelected = selectedId === comm.id;
            const isUnread = comm.status === "unread";
            const displayName = parseDisplayName(comm.from);
            const displaySubject = comm.type === "sms"
              ? comm.preview || "(SMS message)"
              : comm.subject || "(no subject)";

            return (
              <button
                key={comm.id}
                onClick={() => onSelect(comm)}
                className={cn(
                  "w-full text-left p-4 border-b border-border transition-colors",
                  "hover:bg-secondary/50",
                  isSelected && "bg-secondary",
                  isUnread && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 mt-1">
                    <TypeIcon comm={comm} />
                    {isUnread && (
                      <Circle className="w-2 h-2 fill-primary text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("truncate text-sm", isUnread && "font-semibold")}>
                          {displayName}
                        </span>
                        <SourceBadge source={comm.source} type={comm.type} />
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTime(comm.receivedAt)}
                      </span>
                    </div>
                    <p className={cn("text-sm truncate", isUnread && "font-medium")}>
                      {displaySubject}
                    </p>
                    {comm.type !== "sms" && comm.preview && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {comm.preview}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
