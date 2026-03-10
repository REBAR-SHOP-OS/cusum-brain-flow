import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type ManageBendAction =
  | "create-bend-queue"
  | "start-bend"
  | "pause-bend"
  | "complete-bend"
  | "cancel-bend"
  | "create-delivery-from-bundles"
  | "reserve-waste"
  | "consume-waste"
  | "release-waste";

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
  bundleIds?: string[];
  deliveryNumber?: string;
  orderId?: string;
  scheduledDate?: string;
  driverName?: string;
  vehicle?: string;
}

export async function manageBend(params: ManageBendParams) {
  return invokeEdgeFunction("manage-bend", params as any);
}
