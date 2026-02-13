import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pickaxe } from "lucide-react";
import { ProspectTable } from "@/components/prospecting/ProspectTable";
import { ProspectIntroDialog } from "@/components/prospecting/ProspectIntroDialog";

export default function Prospecting() {
  const [region, setRegion] = useState("Canada/USA");
  const [introProspect, setIntroProspect] = useState<any | null>(null);
  const [emailMode, setEmailMode] = useState<"intro" | "followup">("intro");
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Fetch latest batch
  const { data: batches = [] } = useQuery({
    queryKey: ["prospect_batches", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const latestBatch = batches[0];

  // Fetch prospects for latest batch
  const { data: prospects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ["prospects", latestBatch?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("batch_id", latestBatch!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!latestBatch?.id,
  });

  // Dig leads mutation
  const digMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("prospect-leads", {
        body: { region },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: `${data.count} prospects generated!`, description: "Review and approve leads below." });
      qc.invalidateQueries({ queryKey: ["prospect_batches"] });
      qc.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  // Approve prospect → create lead
  const approveMutation = useMutation({
    mutationFn: async (prospect: any) => {
      // Create lead in pipeline
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          title: `${prospect.company_name} — ${prospect.contact_name}`,
          description: prospect.fit_reason,
          source: "ai_prospecting",
          stage: "prospecting",
          company_id: prospect.company_id,
          expected_value: prospect.estimated_value,
          metadata: {
            prospect_id: prospect.id,
            intro_angle: prospect.intro_angle,
            contact_title: prospect.contact_title,
            email: prospect.email,
            phone: prospect.phone,
            city: prospect.city,
            industry: prospect.industry,
          },
        })
        .select("id")
        .single();
      if (leadErr) throw leadErr;

      // Update prospect
      const { error } = await supabase
        .from("prospects")
        .update({ status: "approved", lead_id: lead.id })
        .eq("id", prospect.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => {
      toast({ title: "Approve failed", description: err.message, variant: "destructive" });
    },
  });

  // Reject prospect
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
  });

  // Mark emailed
  const markEmailedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").update({ status: "emailed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
  });

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 sm:px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold">AI Lead Prospecting</h1>
            <p className="text-xs text-muted-foreground">
              {prospects.length > 0
                ? `${prospects.length} prospects · ${prospects.filter((p) => p.status === "approved").length} approved`
                : "Click Dig to generate 50 AI leads"}
            </p>
          </div>

          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region (e.g. Ontario, Canada)"
            className="w-40 lg:w-52 h-8 text-sm"
          />

          <Button
            onClick={() => digMutation.mutate()}
            disabled={digMutation.isPending}
            size="sm"
            className="gap-1.5 h-8"
          >
            {digMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Pickaxe className="w-3.5 h-3.5" />
            )}
            Dig 50 Leads
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {digMutation.isPending ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI is researching prospects…</p>
          </div>
        ) : loadingProspects ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : prospects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Pickaxe className="w-10 h-10" />
            <p className="text-sm">No prospects yet. Click "Dig 50 Leads" to start.</p>
          </div>
        ) : (
          <ProspectTable
            prospects={prospects}
            onApprove={(p) => approveMutation.mutate(p)}
            onReject={(id) => rejectMutation.mutate(id)}
            onSendIntro={(p) => { setEmailMode("intro"); setIntroProspect(p); }}
            onSendFollowup={(p) => { setEmailMode("followup"); setIntroProspect(p); }}
          />
        )}
      </div>

      {introProspect && (
        <ProspectIntroDialog
          prospect={introProspect}
          mode={emailMode}
          open={!!introProspect}
          onOpenChange={(open) => !open && setIntroProspect(null)}
          onSent={() => {
            markEmailedMutation.mutate(introProspect.id);
            setIntroProspect(null);
          }}
        />
      )}
    </div>
  );
}
