import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, DollarSign } from "lucide-react";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { LeadFormModal } from "@/components/pipeline/LeadFormModal";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

// Pipeline stages from Odoo analysis
export const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "telephonic_enquiries", label: "Telephonic Enquiries", color: "bg-cyan-500" },
  { id: "qualified", label: "Qualified", color: "bg-teal-500" },
  { id: "rfi", label: "RFI", color: "bg-green-500" },
  { id: "qc_ben", label: "QC - Ben", color: "bg-lime-500" },
  { id: "addendums", label: "Addendums", color: "bg-yellow-500" },
  { id: "estimation_ben", label: "Estimation - Ben", color: "bg-amber-500" },
  { id: "estimation_karthick", label: "Estimation - Karthick", color: "bg-orange-500" },
  { id: "hot_enquiries", label: "Hot Enquiries", color: "bg-red-500" },
  { id: "quotation_priority", label: "Quotation Priority", color: "bg-rose-500" },
  { id: "quotation_bids", label: "Quotation Bids", color: "bg-pink-500" },
  { id: "won", label: "Won", color: "bg-emerald-500" },
  { id: "shop_drawing", label: "Shop Drawing", color: "bg-violet-500" },
  { id: "shop_drawing_approval", label: "Shop Drawing Sent for Approval", color: "bg-purple-500" },
];

export default function Pipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*, customers(name, company_name)")
        .order("updated_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Lead & { customers: { name: string; company_name: string | null } | null })[];
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ stage })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => {
      toast({ title: "Error moving lead", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead deleted" });
    },
    onError: (error) => {
      toast({ title: "Error deleting lead", description: error.message, variant: "destructive" });
    },
  });

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, typeof leads> = {};
    PIPELINE_STAGES.forEach((stage) => {
      grouped[stage.id] = leads.filter((lead) => lead.stage === stage.id);
    });
    return grouped;
  }, [leads]);

  // Calculate pipeline totals
  const pipelineTotal = useMemo(() => {
    return leads.reduce((sum, lead) => sum + (lead.expected_value || 0), 0);
  }, [leads]);

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingLead(null);
  };

  const handleStageChange = (leadId: string, newStage: string) => {
    updateStageMutation.mutate({ id: leadId, stage: newStage });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {leads.length} lead{leads.length !== 1 ? "s" : ""}
            <span className="mx-2">•</span>
            <DollarSign className="w-3 h-3" />
            {pipelineTotal.toLocaleString()} expected value
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Lead
          </Button>
        </div>
      </header>

      {/* Pipeline Board */}
      <div className="flex-1 overflow-hidden">
        <PipelineBoard
          stages={PIPELINE_STAGES}
          leadsByStage={leadsByStage}
          isLoading={isLoading}
          onStageChange={handleStageChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Form Modal */}
      <LeadFormModal
        open={isFormOpen}
        onOpenChange={handleFormClose}
        lead={editingLead}
      />
    </div>
  );
}
