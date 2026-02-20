import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Upload, ArrowRight, ArrowLeft } from "lucide-react";
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
        body: { name: projectName, file_urls: fileUrls, waste_factor_pct: wasteFactor, scope_context: scopeContext },
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
    // reset
    setStep(1);
    setProjectName("");
    setScopeContext("");
    setWasteFactor(5);
    setFileUrls([]);
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
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" onChange={handleFileUpload} className="hidden" id="wizard-upload" disabled={uploading} />
              <label htmlFor="wizard-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Drop structural drawings here or click to upload"}</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, TIFF</p>
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
            <div><Label>Project Name</Label><Input placeholder="e.g. 20 York St - Foundation" value={projectName} onChange={(e) => setProjectName(e.target.value)} /></div>
            <div><Label>Scope / Context (optional)</Label><Textarea placeholder="e.g. Estimate columns C1-C12 only" value={scopeContext} onChange={(e) => setScopeContext(e.target.value)} rows={2} /></div>
            <div><Label>Waste Factor (%)</Label><Input type="number" value={wasteFactor} onChange={(e) => setWasteFactor(Number(e.target.value))} min={0} max={20} className="w-32" /></div>
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
