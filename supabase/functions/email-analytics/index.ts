import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Aggregates email analytics (daily volume, categories, top senders) for the user's company.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
Deno.serve((req) =>
  handleRequest(req, async ({ companyId, serviceClient, body }) => {
    const daysBack = body.daysBack ?? 30;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    const { data: rows, error } = await serviceClient
      .from("communications")
      .select("direction, received_at, from_address, to_address, ai_category, ai_action_required, status, ai_urgency")
      .eq("company_id", companyId)
      .eq("source", "gmail")
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(1000);

    if (error) throw new Error(error.message);

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

      const cat = (email.ai_category as string) || "Uncategorized";
      categories[cat] = (categories[cat] || 0) + 1;

      if (email.ai_action_required) actionRequired++;

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

    return {
      dailyVolume,
      totalEmails: emails.length,
      totalInbound,
      totalOutbound: emails.length - totalInbound,
      actionRequired,
      actionRequiredRate: emails.length > 0 ? Math.round((actionRequired / emails.length) * 100) : 0,
      categoryDistribution: categories,
      topSenders,
    };
  }, { functionName: "email-analytics", wrapResult: false }),
);
