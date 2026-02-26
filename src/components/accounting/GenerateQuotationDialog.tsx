import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  leadCustomerName?: string;
}

export function GenerateQuotationDialog({ open, onOpenChange, leadId, leadCustomerName }: Props) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [customerName, setCustomerName] = useState(leadCustomerName || "");
  const [generating, setGenerating] = useState(false);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["estimation_projects_for_quote", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimation_projects")
        .select("id, name, status, total_weight_kg, total_cost, lead_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!companyId,
  });

  const handleGenerate = async () => {
    if (!selectedProject) {
      toast({ title: "Select a project", description: "Choose an estimation project to generate from.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-quotation", {
        body: {
          estimation_project_id: selectedProject,
          lead_id: leadId || null,
          customer_name_override: customerName || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Quotation generated!", description: `Quote ${data.quote?.quote_number} created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["archived_quotations"] });
      onOpenChange(false);
      setSelectedProject("");
      setCustomerName("");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err?.message || "Could not generate quotation.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate AI Quotation
          </DialogTitle>
          <DialogDescription>
            Select an estimation project to auto-generate a professional quotation from BOM data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Estimation Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder={projectsLoading ? "Loading…" : "Select project"} />
              </SelectTrigger>
              <SelectContent>
                {(projects || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {Number(p.total_weight_kg || 0).toFixed(0)} kg
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Customer Name (optional override)</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Auto-detected from project"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating || !selectedProject} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Generating…" : "Generate with AI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
