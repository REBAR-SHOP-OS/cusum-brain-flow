import { useState } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChatSessions, type ChatSession } from "@/hooks/useChatSessions";
import { formatDistanceToNow, isToday, isThisWeek, differenceInDays } from "date-fns";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession?: (sessionId: string) => void;
}

interface HistoryGroup {
  label: string;
  items: ChatSession[];
}

function groupSessions(sessions: ChatSession[]): HistoryGroup[] {
  const today: ChatSession[] = [];
  const last7: ChatSession[] = [];
  const last30: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const session of sessions) {
    const date = new Date(session.updated_at);
    if (isToday(date)) {
      today.push(session);
    } else if (isThisWeek(date)) {
      last7.push(session);
    } else if (differenceInDays(new Date(), date) <= 30) {
      last30.push(session);
    } else {
      older.push(session);
    }
  }

  const groups: HistoryGroup[] = [];
  if (today.length > 0) groups.push({ label: "Today", items: today });
  if (last7.length > 0) groups.push({ label: "Last 7 days", items: last7 });
  if (last30.length > 0) groups.push({ label: "Last 30 days", items: last30 });
  if (older.length > 0) groups.push({ label: "Older", items: older });
  return groups;
}

export function HistoryPanel({ isOpen, onClose, onSelectSession }: HistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { sessions, loading, deleteSession } = useChatSessions();

  if (!isOpen) return null;

  const filtered = searchQuery
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  const groups = groupSessions(filtered);

  return (
    <div className="fixed inset-y-0 left-16 w-80 bg-card border-r border-border z-40 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">History</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-secondary border-0"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {searchQuery ? "No matching conversations" : "No conversations yet"}
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label}>
                <h3 className="text-xs font-medium text-primary mb-3">{group.label}</h3>
                <div className="space-y-1">
                  {group.items.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors group"
                      onClick={() => onSelectSession?.(session.id)}
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0",
                          session.agent_color
                        )}
                      >
                        {session.agent_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(session.updated_at), { addSuffix: false })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
