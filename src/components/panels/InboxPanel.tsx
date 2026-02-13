import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronDown, Loader2, Check, Bell, CheckSquare, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface InboxPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "notifications" | "todos" | "ideas";

function AgentAvatar({ name, color }: { name: string | null; color: string }) {
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0", color)}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const config = {
    notifications: { icon: Bell, label: "No notifications right now" },
    todos: { icon: CheckSquare, label: "No to-dos right now" },
    ideas: { icon: Lightbulb, label: "No ideas right now" },
  };
  const { icon: Icon, label } = config[tab];
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
      <Icon className="w-8 h-8 opacity-40" />
      <p className="text-xs">{label}</p>
    </div>
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
        "rounded-lg transition-colors group",
        item.priority === "high" && "border-l-2 border-destructive",
        item.priority === "low" && "opacity-75",
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
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
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

const tabs: { key: TabKey; label: string }[] = [
  { key: "notifications", label: "Notifications" },
  { key: "todos", label: "To-do" },
  { key: "ideas", label: "Ideas" },
];

export function InboxPanel({ isOpen, onClose }: InboxPanelProps) {
  const {
    notifications,
    todos,
    ideas,
    loading,
    dismissAll,
    markRead,
    markAllRead,
    markActioned,
    dismiss,
  } = useNotifications();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("notifications");

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

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

  const counts: Record<TabKey, number> = {
    notifications: notifications.length,
    todos: todos.length,
    ideas: ideas.length,
  };

  const activeItems =
    activeTab === "notifications" ? notifications : activeTab === "todos" ? todos : ideas;

  const unreadInTab = activeItems.filter((n) => n.status === "unread").length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="inbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-[39]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="inbox-panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed inset-y-0 left-0 md:left-16 w-full sm:w-80 bg-card border-r border-border z-40 flex flex-col shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Inbox</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-border px-2 pt-2 gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors -mb-px border-b-2",
                    activeTab === tab.key
                      ? "border-primary text-foreground bg-background"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {counts[tab.key] > 0 && (
                    <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                      {counts[tab.key]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {/* Tab header actions */}
                  {activeTab === "notifications" && notifications.length > 0 && (
                    <div className="flex items-center justify-end gap-2 mb-1">
                      {unreadInTab > 0 && (
                        <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
                          Mark all read
                        </button>
                      )}
                      <button onClick={dismissAll} className="text-xs text-muted-foreground hover:text-foreground">
                        Dismiss all
                      </button>
                    </div>
                  )}

                  {activeItems.length === 0 ? (
                    <EmptyState tab={activeTab} />
                  ) : (
                    activeItems.map((item) => (
                      <NotificationItem
                        key={item.id}
                        item={item}
                        isExpanded={expandedId === item.id}
                        onToggle={() => handleToggle(item)}
                        onDismiss={(e) => handleDismiss(e, item.id)}
                        onAction={activeTab === "todos" ? (e) => handleAction(e, item.id) : undefined}
                        showCheckmark={activeTab === "todos"}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
