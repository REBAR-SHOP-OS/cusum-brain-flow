import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);

    // Get user's company
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.company_id) {
      return json({ error: "No company found" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const daysBack = body.daysBack ?? 30;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    // Query all company emails with service role (bypasses RLS)
    const { data: rows, error } = await serviceClient
      .from("communications")
      .select("direction, received_at, from_address, to_address, ai_category, ai_action_required, status, ai_urgency")
      .eq("company_id", profile.company_id)
      .eq("source", "gmail")
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(1000);

    if (error) {
      return json({ error: error.message }, 500);
    }

    const emails = rows || [];

    // Aggregate
    const dailyMap = new Map<string, { inbound: number; outbound: number }>();
    const categories: Record<string, number> = {};
    const senderCounts = new Map<string, number>();
    let actionRequired = 0;

    for (const email of emails) {
      const dir = (email.direction || "inbound").toLowerCase();
      const dateStr = email.received_at
        ? new Date(email.received_at).toISOString().slice(0, 10)
        : "unknown";

      if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { inbound: 0, outbound: 0 });
      const day = dailyMap.get(dateStr)!;
      if (dir === "inbound") day.inbound++;
      else day.outbound++;

      // AI category
      const cat = (email.ai_category as string) || "Uncategorized";
      categories[cat] = (categories[cat] || 0) + 1;

      // Action required
      if (email.ai_action_required) actionRequired++;

      // Top senders (inbound only)
      if (dir === "inbound" && email.from_address) {
        const sender = email.from_address;
        senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
      }
    }

    const dailyVolume = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    const totalInbound = emails.filter(
      (e: any) => (e.direction || "").toLowerCase() === "inbound"
    ).length;

    const topSenders = Array.from(senderCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([sender, count]) => ({ sender, count }));

    return json({
      dailyVolume,
      totalEmails: emails.length,
      totalInbound,
      totalOutbound: emails.length - totalInbound,
      actionRequired,
      actionRequiredRate: emails.length > 0 ? Math.round((actionRequired / emails.length) * 100) : 0,
      categoryDistribution: categories,
      topSenders,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 500);
  }
});
