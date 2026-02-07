import { useState } from "react";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useCutPlans, useCutPlanItems, useRebarSizes, useCutterMachines, useMachineCapabilities, CutPlan } from "@/hooks/useCutPlans";
import { CutPlansList } from "@/components/cutter/CutPlansList";
import { CutPlanDetails } from "@/components/cutter/CutPlanDetails";
import { CreatePlanDialog } from "@/components/cutter/CreatePlanDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function CutterPlanning() {
  const { user } = useAuth();
  const { isAdmin, isWorkshop, isOffice } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  const { plans, loading, fetchPlans, createPlan } = useCutPlans();
  const [selectedPlan, setSelectedPlan] = useState<CutPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { items, loading: itemsLoading, addItem, removeItem, fetchItems } = useCutPlanItems(selectedPlan?.id ?? null);
  const rebarSizes = useRebarSizes();
  const machines = useCutterMachines();
  const { capabilities, getMaxBars } = useMachineCapabilities("GENSCO DTX 400", "cut");

  // Get user's company_id
  const { data: profile } = useQuery({
    queryKey: ["profile_company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const handleCreate = async (name: string) => {
    if (!profile?.company_id) return;
    const newPlan = await createPlan(name, profile.company_id);
    if (newPlan) setSelectedPlan(newPlan);
  };

  const handleQueued = () => {
    fetchPlans();
    fetchItems();
    // Refresh selected plan
    if (selectedPlan) {
      setSelectedPlan({ ...selectedPlan, status: "queued" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border">
        <Link to="/shop-floor">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Scissors className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Cutter Planning</h1>
          <p className="text-xs text-muted-foreground">
            {canWrite ? "Create plans, add items, queue to machines" : "View-only access"}
          </p>
        </div>
      </header>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Plans list */}
        <div className="w-72 sm:w-80 border-r border-border shrink-0">
          <CutPlansList
            plans={plans}
            loading={loading}
            selectedId={selectedPlan?.id ?? null}
            onSelect={setSelectedPlan}
            onCreateNew={() => setCreateOpen(true)}
            canWrite={canWrite}
          />
        </div>

        {/* Right: Plan details */}
        <div className="flex-1 min-w-0">
          {selectedPlan ? (
            <CutPlanDetails
              plan={selectedPlan}
              items={items}
              itemsLoading={itemsLoading}
              rebarSizes={rebarSizes}
              capabilities={capabilities}
              getMaxBars={getMaxBars}
              machines={machines}
              canWrite={canWrite}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onQueued={handleQueued}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a plan or create a new one
            </div>
          )}
        </div>
      </div>

      {/* Create Plan Dialog */}
      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
