import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useUnreadSenders() {
  const { user } = useAuth();
  const [unreadSenderIds, setUnreadSenderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("metadata")
        .eq("user_id", user.id)
        .eq("status", "unread")
        .eq("link_to", "/team-hub");

      const ids = new Set<string>();
      data?.forEach((n: any) => {
        const sid = n.metadata?.sender_profile_id;
        if (sid) ids.add(sid);
      });
      setUnreadSenderIds(ids);
    };

    fetch();

    const channelId = `unread-senders-${user.id}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => { fetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return { unreadSenderIds };
}
