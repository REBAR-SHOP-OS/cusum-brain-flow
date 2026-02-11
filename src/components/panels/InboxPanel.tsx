import { useState } from "react";
import { X, ChevronRight, ChevronDown, Loader2, Check } from "lucide-react";
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

function NotificationItem({
  item,
  isExpanded,
  onToggle,
  onDismiss,
  onAction,
  showCheckmark,
}: {
  item: Notification;
  isExpanded: boolean;
  onToggle: () => void;
  onDismiss: (e: React.MouseEvent) => void;
  onAction?: (e: React.MouseEvent) => void;
  showCheckmark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg transition-colors",
        item.status === "unread"
          ? "bg-primary/10 hover:bg-primary/15"
          : "bg-secondary/50 hover:bg-secondary"
      )}
    >
      <div
        onClick={onToggle}
        className="flex items-center gap-3 p-3 cursor-pointer"
      >
        {showCheckmark && (
          <button
            onClick={onAction}
            className="w-5 h-5 rounded border border-muted-foreground/40 flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors flex-shrink-0"
            title="Mark done"
          >
            <Check className="w-3 h-3" />
          </button>
        )}
        {!showCheckmark && <AgentAvatar name={item.agentName} color={item.agentColor} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.agentName ?? "System"} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {!item.linkTo && (
          isExpanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/50 mx-3">
          {item.description && (
            <p className="text-xs text-muted-foreground pt-2">{item.description}</p>
          )}
          {item.expiresAt && (
            <p className="text-xs text-warning">
              Expires {formatDistanceToNow(new Date(item.expiresAt), { addSuffix: true })}
            </p>
          )}
        </div>
      )}
    </div>
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
    dismiss,
  } = useNotifications();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggle = (item: Notification) => {
    if (item.status === "unread") markRead(item.id);
    if (item.linkTo) {
      navigate(item.linkTo);
      onClose();
    } else {
      setExpandedId((prev) => (prev === item.id ? null : item.id));
    }
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dismiss(id);
  };

  const handleAction = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markActioned(id);
  };

  return (
    <div className="fixed inset-y-0 left-0 md:left-16 w-full sm:w-80 bg-card border-r border-border z-40 flex flex-col shadow-xl">
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
                  <button onClick={dismissAll} className="text-xs text-muted-foreground hover:text-foreground">
                    Dismiss all
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <EmptyState label="notifications" />
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <NotificationItem
                      key={n.id}
                      item={n}
                      isExpanded={expandedId === n.id}
                      onToggle={() => handleToggle(n)}
                      onDismiss={(e) => handleDismiss(e, n.id)}
                    />
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
                    <NotificationItem
                      key={todo.id}
                      item={todo}
                      isExpanded={expandedId === todo.id}
                      onToggle={() => handleToggle(todo)}
                      onDismiss={(e) => handleDismiss(e, todo.id)}
                      onAction={(e) => handleAction(e, todo.id)}
                      showCheckmark
                    />
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
                    <NotificationItem
                      key={idea.id}
                      item={idea}
                      isExpanded={expandedId === idea.id}
                      onToggle={() => handleToggle(idea)}
                      onDismiss={(e) => handleDismiss(e, idea.id)}
                    />
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
