import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, type BendContext } from "./lib/helpers.ts";
import { handleCreateBendQueue } from "./handlers/bendQueue.ts";
import { handleStartBend, handlePauseBend, handleCompleteBend, handleCancelBend } from "./handlers/bendActions.ts";
import { handleReserveWaste, handleConsumeWaste, handleReleaseWaste } from "./handlers/wasteBank.ts";
import { handleCreateDeliveryFromBundles } from "./handlers/deliveryFromBundles.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const sb = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Invalid token" }, 401);
    const userId = claimsData.claims.sub as string;

    const { data: userRoles } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const roles = (userRoles || []).map((r: any) => r.role);
    if (!roles.some((r: string) => ["admin", "workshop"].includes(r))) {
      return json({ error: "Forbidden: insufficient role" }, 403);
    }

    const body = await req.json();
    const { action } = body;
    const ctx: BendContext = { userId, body, supabaseUser, sb };

    switch (action) {
      case "create-bend-queue":
        return await handleCreateBendQueue(ctx);
      case "start-bend":
        return await handleStartBend(ctx);
      case "pause-bend":
        return await handlePauseBend(ctx);
      case "complete-bend":
        return await handleCompleteBend(ctx);
      case "cancel-bend":
        return await handleCancelBend(ctx);
      case "create-delivery-from-bundles":
        return await handleCreateDeliveryFromBundles(ctx);
      case "reserve-waste":
        return await handleReserveWaste(ctx);
      case "consume-waste":
        return await handleConsumeWaste(ctx);
      case "release-waste":
        return await handleReleaseWaste(ctx);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("manage-bend error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
