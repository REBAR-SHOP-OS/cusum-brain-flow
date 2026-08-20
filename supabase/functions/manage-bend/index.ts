import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, type BendContext } from "./lib/helpers.ts";
import { handleCreateBendQueue } from "./handlers/bendQueue.ts";
import { handleStartBend, handlePauseBend, handleCompleteBend, handleCancelBend } from "./handlers/bendActions.ts";
import { handleReserveWaste, handleConsumeWaste, handleReleaseWaste } from "./handlers/wasteBank.ts";
import { handleCreateDeliveryFromBundles } from "./handlers/deliveryFromBundles.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, body, serviceClient, userClient } = ctx;

    // Build legacy BendContext for existing handlers
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabaseUser = userClient ?? createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const bendCtx: BendContext = { userId, body, supabaseUser, sb: serviceClient };
    const { action } = body;

    switch (action) {
      case "create-bend-queue":
        return await handleCreateBendQueue(bendCtx);
      case "start-bend":
        return await handleStartBend(bendCtx);
      case "pause-bend":
        return await handlePauseBend(bendCtx);
      case "complete-bend":
        return await handleCompleteBend(bendCtx);
      case "cancel-bend":
        return await handleCancelBend(bendCtx);
      case "create-delivery-from-bundles":
        return await handleCreateDeliveryFromBundles(bendCtx);
      case "reserve-waste":
        return await handleReserveWaste(bendCtx);
      case "consume-waste":
        return await handleConsumeWaste(bendCtx);
      case "release-waste":
        return await handleReleaseWaste(bendCtx);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  }, { functionName: "manage-bend", requireAnyRole: ["admin", "workshop"], wrapResult: false })
);
