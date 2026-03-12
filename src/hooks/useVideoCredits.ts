import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VideoCredits {
  id: string;
  user_id: string;
  total_seconds: number;
  used_seconds: number;
  plan: string;
  period_start: string;
  period_end: string;
}

const CREDIT_COSTS: Record<string, number> = {
  fast: 1,      // 1x multiplier
  balanced: 2,  // 2x multiplier
  premium: 3,   // 3x multiplier
};

export function useVideoCredits() {
  const queryClient = useQueryClient();

  const { data: credits, isLoading } = useQuery({
    queryKey: ["video_credits"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Try to get current period credits
      const { data, error } = await supabase
        .from("video_credits")
        .select("*")
        .eq("user_id", user.id)
        .eq("period_start", periodStart)
        .maybeSingle();

      if (error) throw error;

      // Auto-create if not exists (free plan: 60s/month)
      if (!data) {
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        const { data: created, error: createErr } = await supabase
          .from("video_credits")
          .insert({
            user_id: user.id,
            total_seconds: 60,
            used_seconds: 0,
            plan: "free",
            period_start: periodStart,
            period_end: periodEnd,
          })
          .select()
          .single();
        if (createErr) throw createErr;
        return created as VideoCredits;
      }

      return data as VideoCredits;
    },
  });

  const consumeCredits = useMutation({
    mutationFn: async ({ durationSeconds, mode, generationId }: { durationSeconds: number; mode: string; generationId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!credits) throw new Error("Credits not loaded");

      const cost = durationSeconds * (CREDIT_COSTS[mode] || 1);
      const remaining = credits.total_seconds - credits.used_seconds;

      if (cost > remaining) {
        throw new Error(`Not enough credits. Need ${cost}s, have ${remaining}s remaining.`);
      }

      // Update credits
      const { error: updateErr } = await supabase
        .from("video_credits")
        .update({ used_seconds: credits.used_seconds + cost, updated_at: new Date().toISOString() })
        .eq("id", credits.id);
      if (updateErr) throw updateErr;

      // Log usage
      const { error: logErr } = await supabase
        .from("video_usage_log")
        .insert({
          user_id: user.id,
          credits_id: credits.id,
          seconds_used: cost,
          generation_mode: mode,
        });
      if (logErr) console.error("Usage log error:", logErr);

      // Write ledger entry
      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        generation_id: generationId || null,
        type: "reserve",
        amount: cost,
        description: `Reserved ${cost}s for ${mode} ${durationSeconds}s video`,
      });

      return { cost, remaining: remaining - cost };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_credits"] });
    },
  });

  const refundCredits = useMutation({
    mutationFn: async ({ cost, generationId }: { cost: number; generationId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!credits) throw new Error("Credits not loaded");

      // Restore credits
      const newUsed = Math.max(0, credits.used_seconds - cost);
      const { error: updateErr } = await supabase
        .from("video_credits")
        .update({ used_seconds: newUsed, updated_at: new Date().toISOString() })
        .eq("id", credits.id);
      if (updateErr) throw updateErr;

      // Write refund ledger entry
      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        generation_id: generationId || null,
        type: "refund",
        amount: cost,
        description: `Refund ${cost}s — generation failed`,
      });

      return { refunded: cost };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_credits"] });
    },
  });

  const { data: totalSpent = 0 } = useQuery({
    queryKey: ["total_spent"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase
        .from("credit_ledger")
        .select("type, amount")
        .eq("user_id", user.id);

      if (error) { console.error("Ledger query error:", error); return 0; }
      if (!data) return 0;

      let total = 0;
      for (const row of data) {
        if (row.type === "reserve" || row.type === "consume") total += row.amount;
        else if (row.type === "refund") total -= row.amount;
      }
      return Math.max(0, total);
    },
  });

  const remaining = credits ? credits.total_seconds - credits.used_seconds : 0;
  const total = credits?.total_seconds || 60;
  const usedPercent = credits ? Math.round((credits.used_seconds / credits.total_seconds) * 100) : 0;

  const canGenerate = (durationSeconds: number, mode: string) => {
    const cost = durationSeconds * (CREDIT_COSTS[mode] || 1);
    return remaining >= cost;
  };

  const getCost = (durationSeconds: number, mode: string) => {
    return durationSeconds * (CREDIT_COSTS[mode] || 1);
  };

  return {
    credits,
    isLoading,
    remaining,
    total,
    usedPercent,
    totalSpent,
    plan: credits?.plan || "free",
    canGenerate,
    getCost,
    consumeCredits,
    refundCredits,
  };
}
