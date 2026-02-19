import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playMockingjayWhistle } from "@/lib/notificationSound";
import { requestNotificationPermission, showBrowserNotification, registerPushSubscription } from "@/lib/browserNotification";
import { normalizeNotificationRoute } from "@/lib/notificationRouting";
import { toast } from "sonner";

export interface Notification {
  id: string;
  type: "notification" | "todo" | "idea";
  title: string;
  description: string | null;
  agentName: string | null;
  agentColor: string;
  status: "unread" | "read" | "dismissed" | "actioned";
  priority: "low" | "normal" | "high";
  linkTo: string | null;
  metadata: Record<string, unknown> | null;
  expiresAt: string | null;
  assignedTo: string | null;
  reminderAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const mapRow = (row: any): Notification => ({
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    agentName: row.agent_name,
    agentColor: row.agent_color ?? "bg-sky-500",
    status: row.status,
    priority: row.priority,
    linkTo: row.link_to,
    metadata: row.metadata,
    expiresAt: row.expires_at,
    assignedTo: row.assigned_to,
    reminderAt: row.reminder_at,
    createdAt: row.created_at,
  });

  // Fetch current user id for realtime filtering
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .not("status", "eq", "dismissed")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications((data ?? []).map(mapRow));
    } catch (err) {
      console.error("Failed to load notifications:", err);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" as const } : n))
    );
    const { error } = await supabase.from("notifications").update({ status: "read" }).eq("id", id);
    if (error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "unread" as const } : n))
      );
      toast.error("Failed to mark as read");
    }
  }, []);

  // Dismiss single notification
  const dismiss = useCallback(async (id: string) => {
    let removed: Notification | undefined;
    setNotifications((prev) => {
      removed = prev.find((n) => n.id === id);
      return prev.filter((n) => n.id !== id);
    });
    const { error } = await supabase.from("notifications").update({ status: "dismissed" }).eq("id", id);
    if (error && removed) {
      setNotifications((prev) => [removed!, ...prev]);
      toast.error("Failed to dismiss notification");
    }
  }, []);

  // Dismiss all notifications (fixed stale closure)
  const dismissAll = useCallback(async () => {
    let removedItems: Notification[] = [];
    setNotifications((prev) => {
      removedItems = prev.filter((n) => n.type === "notification");
      return prev.filter((n) => n.type !== "notification");
    });
    if (removedItems.length === 0) return;
    const ids = removedItems.map((n) => n.id);
    const { error } = await supabase.from("notifications").update({ status: "dismissed" }).in("id", ids);
    if (error) {
      setNotifications((prev) => [...removedItems, ...prev]);
      toast.error("Failed to dismiss notifications");
    }
  }, []);

  // Mark all as read (fixed stale closure)
  const markAllRead = useCallback(async () => {
    let unreadIds: string[] = [];
    setNotifications((prev) => {
      unreadIds = prev.filter((n) => n.status === "unread").map((n) => n.id);
      return prev.map((n) =>
        n.status === "unread" ? { ...n, status: "read" as const } : n
      );
    });
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .in("id", unreadIds);
    if (error) {
      setNotifications((prev) =>
        prev.map((n) =>
          unreadIds.includes(n.id) ? { ...n, status: "unread" as const } : n
        )
      );
      toast.error("Failed to mark all as read");
    }
  }, []);

  // Dismiss all for a specific type (todos/ideas)
  const dismissAllByType = useCallback(async (type: "todo" | "idea") => {
    let removedItems: Notification[] = [];
    setNotifications((prev) => {
      removedItems = prev.filter((n) => n.type === type);
      return prev.filter((n) => n.type !== type);
    });
    if (removedItems.length === 0) return;
    const ids = removedItems.map((n) => n.id);
    const { error } = await supabase.from("notifications").update({ status: "dismissed" }).in("id", ids);
    if (error) {
      setNotifications((prev) => [...removedItems, ...prev]);
      toast.error("Failed to dismiss items");
    }
  }, []);

  // Mark as actioned
  const markActioned = useCallback(async (id: string) => {
    let removed: Notification | undefined;
    setNotifications((prev) => {
      removed = prev.find((n) => n.id === id);
      return prev.filter((n) => n.id !== id);
    });
    const { error } = await supabase.from("notifications").update({ status: "actioned" }).eq("id", id);
    if (error && removed) {
      setNotifications((prev) => [removed!, ...prev]);
      toast.error("Failed to mark as done");
    }
  }, []);

  useEffect(() => {
    load();
    requestNotificationPermission().then(() => {
      // Only register push if permission was actually granted
      if ("Notification" in window && Notification.permission === "granted") {
        registerPushSubscription();
      }
    });
  }, [load]);

  // Realtime subscription filtered by user_id
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playMockingjayWhistle();
            const newRow = payload.new as any;
            showBrowserNotification(newRow.title, newRow.description, newRow.link_to);

            // Team chat messages: dispatch custom event for ChatPanelContext
            const metadata = newRow.metadata as Record<string, unknown> | null;
            if (metadata?.channel_id) {
              window.dispatchEvent(new CustomEvent("team-chat-incoming", {
                detail: {
                  channelId: metadata.channel_id,
                  title: newRow.title,
                  description: newRow.description,
                },
              }));
            } else {
              toast(newRow.title, {
                description: newRow.description || undefined,
                duration: 8000,
            action: newRow.link_to ? {
                  label: "View",
                  onClick: () => {
                    const dest = normalizeNotificationRoute(newRow.link_to, newRow.type);
                    window.location.href = dest;
                  },
                } : undefined,
              });
            }
            setNotifications((prev) => [mapRow(newRow), ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updated = mapRow(payload.new);
            if (updated.status === "dismissed") {
              setNotifications((prev) => prev.filter((n) => n.id !== updated.id));
            } else {
              setNotifications((prev) =>
                prev.map((n) => (n.id === updated.id ? updated : n))
              );
            }
          } else if (payload.eventType === "DELETE") {
            setNotifications((prev) =>
              prev.filter((n) => n.id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const items = notifications.filter((n) => n.type === "notification");
  const todos = notifications.filter((n) => n.type === "todo");
  const ideas = notifications.filter((n) => n.type === "idea");
  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return {
    notifications: items,
    todos,
    ideas,
    unreadCount,
    loading,
    refresh: load,
    markRead,
    markAllRead,
    dismiss,
    dismissAll,
    dismissAllByType,
    markActioned,
  };
}
