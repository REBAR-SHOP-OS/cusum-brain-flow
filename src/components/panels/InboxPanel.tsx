import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, ChevronRight, ChevronDown, Loader2, Check, Bell, CheckSquare, Lightbulb, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeNotificationRoute } from "@/lib/notificationRouting";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { NotificationFilters } from "@/components/notifications/NotificationFilters";

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

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === "high") {
    return <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />;
  }
  return null;
}

function EmptyState({ tab }: { tab: TabKey }) {
  const config = {
    notifications: { icon: Bell, label: "You're all caught up!", sub: "No new notifications" },
    todos: { icon: CheckSquare, label: "Nothing on your plate!", sub: "No to-dos right now" },
    ideas: { icon: Lightbulb, label: "Idea board is empty", sub: "New ideas will appear here" },
  };
  const { icon: Icon, label, sub } = config[tab];
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-1">
        <Icon className="w-6 h-6 opacity-50" />
      </div>
      <p className="text-sm font-medium text-foreground/70">{label}</p>
      <p className="text-xs">{sub}</p>
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
            aria-label="Mark as done"
            className="w-5 h-5 rounded border border-muted-foreground/40 flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <Check className="w-3 h-3" />
          </button>
        )}
        {!showCheckmark && (
          <div className="relative flex-shrink-0">
            <AgentAvatar name={item.agentName} color={item.agentColor} />
            <PriorityIcon priority={item.priority} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {item.status === "unread" && (
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
            <p className="text-sm font-medium truncate">{item.title}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.agentName ?? "System"} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
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
    unreadCount,
    loading,
    dismissAll,
    dismissAllByType,
    markRead,
    markAllRead,
    markActioned,
    dismiss,
  } = useNotifications();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("notifications");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus close button on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !panelRef.current) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleToggle = (item: Notification) => {
    if (item.status === "unread") markRead(item.id);
    if (item.linkTo) {
      const dest = normalizeNotificationRoute(item.linkTo, item.type);
      navigate(dest);
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

  const handleDismissAllForTab = () => {
    if (activeTab === "notifications") dismissAll();
    else if (activeTab === "todos") dismissAllByType("todo");
    else if (activeTab === "ideas") dismissAllByType("idea");
  };

  const allItems: Record<TabKey, Notification[]> = {
    notifications,
    todos,
    ideas,
  };

  const unreadCounts: Record<TabKey, number> = {
    notifications: notifications.filter((n) => n.status === "unread").length,
    todos: todos.filter((n) => n.status === "unread").length,
    ideas: ideas.filter((n) => n.status === "unread").length,
  };

  // Apply search + priority filter
  const filteredItems = useMemo(() => {
    let items = allItems[activeTab];
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      items = items.filter(n => n.title.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q));
    }
    if (filterPriority !== "all") {
      items = items.filter(n => n.priority === filterPriority);
    }
    return items;
  }, [allItems, activeTab, filterSearch, filterPriority]);

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    const map = new Map<string, Notification[]>();
    for (const item of filteredItems) {
      const d = new Date(item.createdAt);
      const key = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const [label, items] of map) groups.push({ label, items });
    return groups;
  }, [filteredItems]);

  const activeItems = filteredItems;
  const unreadInTab = unreadCounts[activeTab];

  return (
    <>
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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Inbox"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed inset-y-0 left-0 md:left-16 w-full sm:w-80 bg-card border-r border-border z-40 flex flex-col shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                Inbox
                {unreadCount > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({unreadCount} unread)
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setPrefsOpen(true)} aria-label="Notification settings" className="h-8 w-8">
                  <Settings className="w-4 h-4" />
                </Button>
                <Button ref={closeButtonRef} variant="ghost" size="icon" onClick={onClose} aria-label="Close inbox" className="focus-visible:ring-2 focus-visible:ring-primary">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-border px-2 pt-2 gap-1" role="tablist" aria-label="Inbox tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors -mb-px border-b-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    activeTab === tab.key
                      ? "border-primary text-foreground bg-background"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {unreadCounts[tab.key] > 0 && (
                    <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                      {unreadCounts[tab.key]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <NotificationFilters
              search={filterSearch}
              onSearchChange={setFilterSearch}
              priorityFilter={filterPriority}
              onPriorityChange={setFilterPriority}
            />

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2" role="tabpanel" aria-label={`${activeTab} list`}>
                  {activeItems.length > 0 && (
                    <div className="flex items-center justify-end gap-2 mb-1">
                      {unreadInTab > 0 && (
                        <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded px-1">
                          Mark all read
                        </button>
                      )}
                      <button onClick={handleDismissAllForTab} className="text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded px-1">
                        Dismiss all
                      </button>
                    </div>
                  )}

                  {activeItems.length === 0 ? (
                    <EmptyState tab={activeTab} />
                  ) : (
                    groupedItems.map((group) => (
                      <div key={group.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1">{group.label}</p>
                        {group.items.map((item) => (
                          <NotificationItem
                            key={item.id}
                            item={item}
                            isExpanded={expandedId === item.id}
                            onToggle={() => handleToggle(item)}
                            onDismiss={(e) => handleDismiss(e, item.id)}
                            onAction={activeTab === "todos" ? (e) => handleAction(e, item.id) : undefined}
                            showCheckmark={activeTab === "todos"}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <NotificationPreferences open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  );
}
