import { supabase } from "@/integrations/supabase/client";

export type ManageBendAction =
  | "create-bend-queue"
  | "start-bend"
  | "pause-bend"
  | "complete-bend"
  | "cancel-bend"
  | "create-delivery-from-bundles";

export interface ManageBendParams {
  action: ManageBendAction;
  cutBatchId?: string;
  bendBatchId?: string;
  machineId?: string;
  bendPattern?: string;
  shape?: string;
  size?: string;
  companyId?: string;
  actualQty?: number;
  // delivery fields
  bundleIds?: string[];
  deliveryNumber?: string;
  orderId?: string;
  scheduledDate?: string;
  driverName?: string;
  vehicle?: string;
}

export async function manageBend(params: ManageBendParams) {
  const { data, error } = await supabase.functions.invoke("manage-bend", {
    body: params,
  });
  if (error) throw new Error(error.message || "Failed to manage bend");
  if (data?.error) throw new Error(data.error);
  return data;
}
