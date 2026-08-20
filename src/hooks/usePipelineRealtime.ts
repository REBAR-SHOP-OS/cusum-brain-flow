import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

/**
 * Subscribes to realtime lead changes and invalidates pipeline queries.
 * Shows toast notifications for stage changes and SLA breaches.
 */
export function usePipelineRealtime() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`pipeline-realtime-${companyId || "global"}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const newLead = payload.new as any;
          const oldLead = payload.old as any;

          // Invalidate pipeline queries
          queryClient.invalidateQueries({ queryKey: ["pipeline-intelligence-leads"] });
          queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });

          // Toast for stage changes
          if (oldLead.stage && newLead.stage && oldLead.stage !== newLead.stage) {
            const title = newLead.title || "Lead";
            toast.info(`📋 ${title} moved to ${newLead.stage.replace(/_/g, " ")}`, {
              duration: 4000,
            });
          }

          // Toast for SLA breach
          if (!oldLead.sla_breached && newLead.sla_breached) {
            toast.error(`⏰ SLA Breach: ${newLead.title || "Lead"}`, {
              duration: 6000,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipeline-intelligence-leads"] });
          queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pipeline_transition_log" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipeline-activity-feed"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [queryClient, companyId]);
}
