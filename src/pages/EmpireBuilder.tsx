import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { EmpireBoard } from "@/components/empire/EmpireBoard";
import { VentureDetail } from "@/components/empire/VentureDetail";
import { NewVentureDialog } from "@/components/empire/NewVentureDialog";
import { Button } from "@/components/ui/button";
import { Plus, Rocket } from "lucide-react";
import { toast } from "sonner";

export type Venture = {
  id: string;
  created_by: string;
  company_id: string | null;
  name: string;
  vertical: string | null;
  phase: string;
  problem_statement: string | null;
  target_customer: string | null;
  value_multiplier: string | null;
  competitive_notes: string | null;
  mvp_scope: string | null;
  distribution_plan: string | null;
  metrics: Record<string, unknown>;
  revenue_model: string | null;
  ai_analysis: Record<string, unknown> | null;
  linked_lead_id: string | null;
  linked_order_ids: string[];
  odoo_context: Record<string, unknown> | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const PHASES = [
  { key: "target_selection", label: "Target Selection", emoji: "🎯" },
  { key: "weapon_build", label: "Weapon Build", emoji: "⚔️" },
  { key: "market_feedback", label: "Market Feedback", emoji: "📊" },
  { key: "scale_engine", label: "Scale Engine", emoji: "🚀" },
  { key: "empire_expansion", label: "Empire Expansion", emoji: "🏛️" },
];

export { PHASES };

const EmpireBuilder = () => {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [selectedVenture, setSelectedVenture] = useState<Venture | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: ventures = [], isLoading } = useQuery({
    queryKey: ["ventures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventures" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as Venture[];
    },
  });

  const updateVenture = useMutation({
    mutationFn: async (updates: Partial<Venture> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase
        .from("ventures" as any)
        .update(rest as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createVenture = useMutation({
    mutationFn: async (v: { name: string; vertical: string; problem_statement: string }) => {
      const { error } = await supabase.from("ventures" as any).insert({
        ...v,
        created_by: user?.id,
        company_id: companyId,
        phase: "target_selection",
        status: "active",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventures"] });
      setShowNew(false);
      toast.success("Venture created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePhaseChange = (id: string, phase: string) => {
    updateVenture.mutate({ id, phase });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Rocket className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Empire Builder</h1>
            <p className="text-sm text-muted-foreground">Venture architect — integrated with ERP, Odoo & rebar.shop</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Venture
        </Button>
      </div>

      <EmpireBoard
        ventures={ventures}
        phases={PHASES}
        isLoading={isLoading}
        onSelect={setSelectedVenture}
        onPhaseChange={handlePhaseChange}
      />

      {selectedVenture && (
        <VentureDetail
          venture={selectedVenture}
          open={!!selectedVenture}
          onClose={() => setSelectedVenture(null)}
          onUpdate={(updates) => {
            updateVenture.mutate({ id: selectedVenture.id, ...updates });
            setSelectedVenture({ ...selectedVenture, ...updates });
          }}
        />
      )}

      <NewVentureDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={(v) => createVenture.mutate(v)}
        isLoading={createVenture.isPending}
      />
    </div>
  );
};

export default EmpireBuilder;
