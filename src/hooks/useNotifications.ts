import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playMockingjayWhistle } from "@/lib/notificationSound";
import { requestNotificationPermission, showBrowserNotification, registerPushSubscription } from "@/lib/browserNotification";

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
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ status: "read" }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" as const } : n))
    );
  }, []);

  // Dismiss single notification
  const dismiss = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ status: "dismissed" }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Dismiss all notifications
  const dismissAll = useCallback(async () => {
    const ids = notifications.filter((n) => n.type === "notification").map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ status: "dismissed" }).in("id", ids);
    setNotifications((prev) => prev.filter((n) => n.type !== "notification"));
  }, [notifications]);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((n) => n.status === "unread")
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("notifications")
      .update({ status: "read" })
      .in("id", unreadIds);
    setNotifications((prev) =>
      prev.map((n) =>
        n.status === "unread" ? { ...n, status: "read" as const } : n
      )
    );
  }, [notifications]);

  // Mark as actioned
  const markActioned = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ status: "actioned" }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    load();
    requestNotificationPermission();
    registerPushSubscription();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playMockingjayWhistle();
            const newRow = payload.new as any;
            showBrowserNotification(newRow.title, newRow.description, newRow.link_to);
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
  }, []);

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
    markActioned,
  };
}
