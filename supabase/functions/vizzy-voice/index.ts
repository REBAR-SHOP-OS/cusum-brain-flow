import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient: supabase, log }) => {
    const text = (body.text || "").toLowerCase().trim();
    if (!text) {
      return new Response(
        JSON.stringify({ error: "text field is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let reply = "";

    const has = (w: string) => text.includes(w);
    const isCount = has("how many") || has("count") || has("total");
    const isLatest = has("latest") || has("recent") || has("show");

    if (isCount && has("cut") && has("plan")) {
      const { count } = await supabase.from("cut_plans").select("*", { count: "exact", head: true });
      reply = `There are ${count ?? 0} cut plans.`;

    } else if (isCount && has("order")) {
      const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
      reply = `You currently have ${count ?? 0} orders.`;

    } else if (isCount && has("customer")) {
      const { count } = await supabase.from("customers").select("*", { count: "exact", head: true });
      reply = `You have ${count ?? 0} customers.`;

    } else if (isCount && has("lead")) {
      const { count } = await supabase.from("leads").select("*", { count: "exact", head: true });
      reply = `There are ${count ?? 0} leads in the pipeline.`;

    } else if (isCount && has("machine")) {
      const { count } = await supabase.from("machines").select("*", { count: "exact", head: true });
      reply = `You have ${count ?? 0} machines registered.`;

    } else if (isLatest && has("order")) {
      const { data: orders } = await supabase
        .from("orders")
        .select("order_number, status")
        .order("created_at", { ascending: false })
        .limit(3);

      if (orders && orders.length > 0) {
        const parts = orders.map((o: any) => `${o.order_number} (${o.status || "unknown"})`);
        if (parts.length === 1) {
          reply = `Your latest order is ${parts[0]}.`;
        } else {
          const last = parts.pop();
          reply = `Your latest orders are ${parts.join(", ")}, and ${last}.`;
        }
      } else {
        reply = "No orders found.";
      }

    } else {
      reply = "I can answer questions about orders, customers, leads, machines, and cut plans. Try asking 'how many orders' or 'latest orders'.";
    }

    log.done("Voice query handled", { query: text });
    return { reply };
  }, { functionName: "vizzy-voice", authMode: "none", requireCompany: false, wrapResult: false })
);
