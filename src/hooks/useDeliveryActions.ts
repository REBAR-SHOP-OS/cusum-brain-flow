import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CompletedBundle } from "@/hooks/useCompletedBundles";

export function useDeliveryActions() {
  const [creating, setCreating] = useState(false);
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const createDeliveryFromBundle = async (bundle: CompletedBundle) => {
    if (!companyId) {
      toast.error("Company not found");
      return null;
    }

    setCreating(true);
    try {
      const deliveryNumber = `DEL-${Date.now().toString(36).toUpperCase()}`;
      const slipNumber = `PS-${Date.now().toString(36).toUpperCase()}`;

      const scheduledDate = new Date().toISOString().split("T")[0];

      // 1. Create delivery
      const { data: delivery, error: delErr } = await supabase
        .from("deliveries")
        .insert({
          company_id: companyId,
          delivery_number: deliveryNumber,
          status: "pending",
          scheduled_date: scheduledDate,
          cut_plan_id: bundle.cutPlanId,
        } as any)
        .select()
        .single();

      if (delErr) throw delErr;

      // 2. Create delivery stop
      const { error: stopErr } = await supabase
        .from("delivery_stops")
        .insert({
          company_id: companyId,
          delivery_id: delivery.id,
          stop_sequence: 1,
          status: "pending",
        });

      if (stopErr) throw stopErr;

      // 2b. Fetch project site_address via cut_plan
      let siteAddress: string | null = null;
      try {
        const { data: cpData } = await supabase
          .from("cut_plans")
          .select("project_id")
          .eq("id", bundle.cutPlanId)
          .single();
        if (cpData?.project_id) {
          const { data: proj } = await supabase
            .from("projects")
            .select("site_address")
            .eq("id", cpData.project_id)
            .single();
          siteAddress = (proj as any)?.site_address ?? null;
        }
      } catch { /* non-critical */ }

      // 3. Build items snapshot (includes drawing_ref for DW# column)
      const itemsSnapshot = bundle.items.map((item) => ({
        mark_number: item.mark_number,
        drawing_ref: item.drawing_ref,
        bar_code: item.bar_code,
        cut_length_mm: item.cut_length_mm,
        total_pieces: item.total_pieces,
        asa_shape_code: item.asa_shape_code,
      }));

      // 4. Create packing slip
      const { data: slip, error: slipErr } = await supabase
        .from("packing_slips" as any)
        .insert({
          company_id: companyId,
          delivery_id: delivery.id,
          cut_plan_id: bundle.cutPlanId,
          slip_number: slipNumber,
          customer_name: bundle.projectName,
          items_json: itemsSnapshot,
          status: "draft",
          delivery_date: scheduledDate,
          site_address: siteAddress,
        })
        .select()
        .single();

      if (slipErr) throw slipErr;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["packing-slips"] });

      toast.success(`Delivery ${deliveryNumber} created`);

      return {
        delivery,
        slip,
        slipNumber,
        deliveryNumber,
        items: itemsSnapshot,
      };
    } catch (err: any) {
      toast.error(err.message || "Failed to create delivery");
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { createDeliveryFromBundle, creating };
}
