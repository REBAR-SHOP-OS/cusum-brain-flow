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

  const createDeliveryFromBundle = async (bundle: CompletedBundle, invoiceNumber: string) => {
    if (!companyId) {
      toast.error("Company not found");
      return null;
    }

    setCreating(true);
    try {
      // Retry loop to handle race conditions on delivery_number unique constraint
      let delivery: any = null;
      let deliveryNumber = "";
      let slipNumber = "";
      const scheduledDate = new Date().toISOString().split("T")[0];

      for (let attempt = 0; attempt < 5; attempt++) {
        const { count, error: countErr } = await supabase
          .from("deliveries")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .like("delivery_number", `${invoiceNumber}-%`);
        if (countErr) throw countErr;
        const seq = String((count ?? 0) + 1 + attempt).padStart(2, "0");
        deliveryNumber = `${invoiceNumber}-${seq}`;
        slipNumber = `PS-${invoiceNumber}-${seq}`;

        const { data: delData, error: delErr } = await supabase
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

        if (delErr) {
          // If unique constraint violation, retry with next sequence
          if (delErr.code === "23505" && attempt < 4) continue;
          throw delErr;
        }
        delivery = delData;
        break;
      }

      if (!delivery) throw new Error("Failed to create delivery after retries");

      // 2. Fetch project site_address and order_id via cut_plan → work_order
      let siteAddress: string | null = null;
      let orderId: string | null = null;
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

      // Try to resolve order_id from cut_plan_items → work_order → order
      try {
        const { data: itemWithWo } = await supabase
          .from("cut_plan_items")
          .select("work_order_id")
          .eq("cut_plan_id", bundle.cutPlanId)
          .not("work_order_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (itemWithWo?.work_order_id) {
          const { data: wo } = await supabase
            .from("work_orders")
            .select("order_id")
            .eq("id", itemWithWo.work_order_id)
            .maybeSingle();
          orderId = wo?.order_id ?? null;
        }
      } catch { /* non-critical */ }

      // 3. Create delivery stop (with address and order_id for QC gate)
      const { error: stopErr } = await supabase
        .from("delivery_stops")
        .insert({
          company_id: companyId,
          delivery_id: delivery.id,
          stop_sequence: 1,
          status: "pending",
          address: siteAddress,
          order_id: orderId,
        });

      if (stopErr) throw stopErr;

      // 4. Build items snapshot
      const itemsSnapshot = bundle.items.map((item) => ({
        mark_number: item.mark_number,
        drawing_ref: item.drawing_ref,
        bar_code: item.bar_code,
        cut_length_mm: item.cut_length_mm,
        total_pieces: item.total_pieces,
        asa_shape_code: item.asa_shape_code,
      }));

      // 5. Create packing slip
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
