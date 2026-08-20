import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Aggregates RingCentral call analytics (daily volume, outcomes, top callers) for the user's company.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
Deno.serve((req) =>
  handleRequest(req, async ({ companyId, serviceClient, body }) => {
    const daysBack = body.daysBack ?? 30;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    const { data: rows, error } = await serviceClient
      .from("communications")
      .select("direction, received_at, metadata, from_address, to_address")
      .eq("company_id", companyId)
      .eq("source", "ringcentral")
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(1000);

    if (error) throw new Error(error.message);

    // Filter to calls only
    const calls = (rows || []).filter((r: any) => {
      const meta = r.metadata as Record<string, unknown> | null;
      return meta?.type === "call";
    });

    // Aggregate analytics
    const dailyMap = new Map<string, { inbound: number; outbound: number }>();
    const outcomes: Record<string, number> = {};
    const callerCounts = new Map<string, number>();
    let totalDuration = 0;
    let missed = 0;

    for (const call of calls) {
      const meta = call.metadata as Record<string, unknown> | null;
      const dir = (call.direction || "inbound").toLowerCase();

      const dateStr = call.received_at
        ? new Date(call.received_at).toISOString().slice(0, 10)
        : "unknown";
      if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { inbound: 0, outbound: 0 });
      const day = dailyMap.get(dateStr)!;
      if (dir === "inbound") day.inbound++;
      else day.outbound++;

      const result = (meta?.result as string) || "Unknown";
      outcomes[result] = (outcomes[result] || 0) + 1;
      if (result === "Missed") missed++;

      const duration = (meta?.duration as number) || 0;
      totalDuration += duration;

      const phone = dir === "inbound"
        ? call.from_address || "Unknown"
        : call.to_address || "Unknown";
      callerCounts.set(phone, (callerCounts.get(phone) || 0) + 1);
    }

    const dailyVolume = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    const totalInbound = calls.filter(
      (c: any) => (c.direction || "").toLowerCase() === "inbound"
    ).length;

    const topCallers = Array.from(callerCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([phone, count]) => ({ phone, count }));

    return {
      dailyVolume,
      totalCalls: calls.length,
      totalInbound,
      totalOutbound: calls.length - totalInbound,
      avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
      missedCalls: missed,
      missedRate: calls.length > 0 ? Math.round((missed / calls.length) * 100) : 0,
      outcomeDistribution: outcomes,
      topCallers,
      totalDuration,
    };
  }, { functionName: "ringcentral-call-analytics", wrapResult: false }),
);
