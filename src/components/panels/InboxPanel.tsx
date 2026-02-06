import { X, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface InboxPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function AgentAvatar({ name, color }: { name: string | null; color: string }) {
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0", color)}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-xs text-muted-foreground text-center py-4">No {label} right now</p>
  );
}

export function InboxPanel({ isOpen, onClose }: InboxPanelProps) {
  const {
    notifications,
    todos,
    ideas,
    loading,
    dismissAll,
    markRead,
    markActioned,
  } = useNotifications();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleClick = (item: Notification) => {
    if (item.status === "unread") markRead(item.id);
    if (item.linkTo) {
      navigate(item.linkTo);
      onClose();
    }
  };

  const handleAction = (item: Notification) => {
    markActioned(item.id);
    if (item.linkTo) {
      navigate(item.linkTo);
      onClose();
    }
  };

  return (
    <div className="fixed inset-y-0 left-0 md:left-16 w-full sm:w-80 bg-card border-r border-border z-40 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">Inbox</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Notifications */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Notifications</h3>
                {notifications.length > 0 && (
                  <button
                    onClick={dismissAll}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss all
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <EmptyState label="notifications" />
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        n.status === "unread"
                          ? "bg-primary/10 hover:bg-primary/15"
                          : "bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <AgentAvatar name={n.agentName} color={n.agentColor} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {n.agentName ?? "System"} · {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* To-do */}
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">To-do</h3>
              {todos.length === 0 ? (
                <EmptyState label="to-dos" />
              ) : (
                <div className="space-y-2">
                  {todos.map((todo) => (
                    <div
                      key={todo.id}
                      onClick={() => handleAction(todo)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        todo.status === "unread"
                          ? "bg-primary/10 hover:bg-primary/15"
                          : "bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <AgentAvatar name={todo.agentName} color={todo.agentColor} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{todo.title}</p>
                        <p className="text-xs text-muted-foreground">{todo.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Ideas */}
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Ideas</h3>
              {ideas.length === 0 ? (
                <EmptyState label="ideas" />
              ) : (
                <div className="space-y-2">
                  {ideas.map((idea) => (
                    <div
                      key={idea.id}
                      onClick={() => handleClick(idea)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        idea.status === "unread"
                          ? "bg-primary/10 hover:bg-primary/15"
                          : "bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <AgentAvatar name={idea.agentName} color={idea.agentColor} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{idea.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{idea.description}</p>
                        {idea.expiresAt && (
                          <p className="text-xs text-warning mt-1">
                            Expires {formatDistanceToNow(new Date(idea.expiresAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
