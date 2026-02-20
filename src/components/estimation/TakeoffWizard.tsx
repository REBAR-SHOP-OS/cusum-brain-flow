import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Upload, ArrowRight, ArrowLeft, Users, Briefcase } from "lucide-react";
import TakeoffPipeline from "./TakeoffPipeline";

interface TakeoffWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (projectId: string) => void;
}

export default function TakeoffWizard({ open, onClose, onComplete }: TakeoffWizardProps) {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [scopeContext, setScopeContext] = useState("");
  const [wasteFactor, setWasteFactor] = useState(5);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);

  // ERP linking
  const [customerId, setCustomerId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("customers").select("id, name").order("name").then(({ data }) => {
      setCustomers(data ?? []);
    });
  }, [open]);

  useEffect(() => {
    if (!customerId) { setLeads([]); return; }
    supabase.from("leads").select("id, title, stage")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setLeads(data ?? []); });
  }, [customerId]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `estimation/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("estimation-files").upload(path, file);
      if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
      const { data: urlData } = supabase.storage.from("estimation-files").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    setFileUrls((prev) => [...prev, ...urls]);
    setUploading(false);
    toast.success(`${urls.length} file(s) uploaded`);
  }, []);

  const runTakeoff = async () => {
    setStep(3);
    setPipelineStage("uploading");
    await new Promise((r) => setTimeout(r, 600));
    setPipelineStage("ocr");
    await new Promise((r) => setTimeout(r, 600));
    setPipelineStage("extraction");

    try {
      const { data, error } = await supabase.functions.invoke("ai-estimate", {
        body: {
          name: projectName,
          file_urls: fileUrls,
          waste_factor_pct: wasteFactor,
          scope_context: scopeContext,
          customer_id: customerId || undefined,
          lead_id: leadId || undefined,
        },
      });
      if (error) throw error;
      setPipelineStage("calculation");
      await new Promise((r) => setTimeout(r, 400));
      setPipelineStage("complete");
      setResultData(data);
      setTimeout(() => setStep(4), 1000);
    } catch (err: any) {
      setPipelineStage(null);
      toast.error(`Takeoff failed: ${err.message}`);
      setStep(2);
    }
  };

  const handleComplete = () => {
    if (resultData?.project_id) {
      onComplete(resultData.project_id);
    }
    setStep(1);
    setProjectName("");
    setScopeContext("");
    setWasteFactor(5);
    setFileUrls([]);
    setCustomerId("");
    setLeadId("");
    setPipelineStage(null);
    setResultData(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Takeoff — Step {step} of 4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.xls,.xlsx,.csv" onChange={handleFileUpload} className="hidden" id="wizard-upload" disabled={uploading} />
              <label htmlFor="wizard-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Upload drawing ledger"}</p>
                <p className="text-xs text-muted-foreground mt-1">PDF · Spreadsheet (XLSX/CSV) · Image (PNG/JPG) · Any File</p>
              </label>
            </div>
            {fileUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {fileUrls.map((_, i) => (
                  <Badge key={i} variant="secondary"><FileText className="h-3 w-3 mr-1" />File {i + 1}</Badge>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={fileUrls.length === 0}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Project Name *</Label>
                <Input placeholder="e.g. 20 York Valley Cres - Cabana" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {customerId && leads.length > 0 && (
              <div>
                <Label className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Lead</Label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger><SelectValue placeholder="Link to lead..." /></SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title} <span className="text-muted-foreground ml-1">({l.stage})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Scope / Context (optional)</Label>
              <Textarea placeholder="e.g. Estimate retaining walls W6-W10 only" value={scopeContext} onChange={(e) => setScopeContext(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Waste Factor (%)</Label>
              <Input type="number" value={wasteFactor} onChange={(e) => setWasteFactor(Number(e.target.value))} min={0} max={20} className="w-32" />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
              <Button onClick={runTakeoff} disabled={!projectName}>Run AI Takeoff <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-8">
            <TakeoffPipeline stage={pipelineStage} />
            <p className="text-center text-sm text-muted-foreground mt-4">Processing your drawings with AI...</p>
          </div>
        )}

        {step === 4 && resultData && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{resultData.summary?.item_count ?? 0}</p>
                <p className="text-xs text-muted-foreground">Items</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{(resultData.summary?.total_weight_kg ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">kg</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">${(resultData.summary?.total_cost ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
              </div>
            </div>
            <Button className="w-full" onClick={handleComplete}>Save & View Project</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
