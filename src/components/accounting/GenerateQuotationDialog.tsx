import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  leadCustomerName?: string;
}

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.xls";

export function GenerateQuotationDialog({ open, onOpenChange, leadId, leadCustomerName }: Props) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // shared
  const [generating, setGenerating] = useState(false);
  const [addToPipeline, setAddToPipeline] = useState(false);
  const [tab, setTab] = useState<string>("project");
  const [deliveryDistance, setDeliveryDistance] = useState<string>("");
  const [includeShopDrawings, setIncludeShopDrawings] = useState(true);
  const [scrapPercent, setScrapPercent] = useState<string>("15");

  // Tab 1 — existing project
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [customerName, setCustomerName] = useState(leadCustomerName || "");

  // Tab 2 — upload new files
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [projectName, setProjectName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(leadId || "");
  const [dragOver, setDragOver] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedProject("");
      setCustomerName(leadCustomerName || "");
      setUploadFiles([]);
      setProjectName("");
      setSelectedCustomerId("");
      setSelectedLeadId(leadId || "");
      setAddToPipeline(false);
      setDeliveryDistance("");
      setIncludeShopDrawings(true);
      setScrapPercent("15");
      setTab("project");
    }
  }, [open, leadCustomerName, leadId]);

  // Queries
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["estimation_projects_for_quote", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimation_projects")
        .select("id, name, status, total_weight_kg, total_cost, lead_id, customer_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!companyId,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers_for_quote", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_customers_clean" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("name" as any, { ascending: true });
      return (data as any[]) || [];
    },
    enabled: open && !!companyId,
  });

  const { data: leads } = useQuery({
    queryKey: ["sales_leads_for_quote", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_leads")
        .select("id, title, contact_name, contact_company")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: open && !!companyId,
  });

  // Auto-populate customer/lead from selected estimation project
  useEffect(() => {
    if (!selectedProject || !projects?.length) return;
    const proj = projects.find((p) => p.id === selectedProject);
    if (!proj) return;

    // Auto-fill lead if empty
    if (!selectedLeadId && proj.lead_id) {
      setSelectedLeadId(proj.lead_id);
    }

    // Auto-fill customer name from lead or customer record
    if (!customerName) {
      if (proj.lead_id && leads?.length) {
        const lead = leads.find((l) => l.id === proj.lead_id);
        if (lead) {
          setCustomerName(lead.contact_company || lead.contact_name || "");
        }
      }
      if (proj.customer_id && customers?.length) {
        const cust = (customers as any[]).find((c: any) => c.customer_id === proj.customer_id);
        if (cust) {
          setCustomerName(cust.display_name || cust.company_name || cust.normalized_name || "");
        }
      }
    }
  }, [selectedProject, projects, leads, customers, customerName, selectedLeadId]);

  // File handlers
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return ["pdf", "png", "jpg", "jpeg", "xlsx", "csv", "xls"].includes(ext);
    });
    if (arr.length === 0) return;
    setUploadFiles((prev) => [...prev, ...arr].slice(0, 4));
    if (!projectName && arr[0]) {
      setProjectName(arr[0].name.replace(/\.[^.]+$/, ""));
    }
  }, [projectName]);

  const removeFile = (idx: number) => setUploadFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length) {
      e.preventDefault();
      addFiles(e.clipboardData.files);
    }
  }, [addFiles]);

  // Generate from existing project
  const handleGenerateFromProject = async () => {
    if (!selectedProject) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-quotation", {
        body: {
          estimation_project_id: selectedProject,
          lead_id: leadId || selectedLeadId || null,
          customer_name_override: customerName || null,
          delivery_distance_km: Number(deliveryDistance) || 0,
          include_shop_drawings: includeShopDrawings,
          scrap_percent: Number(scrapPercent) || 15,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.failure_reason) throw new Error(data.error || `Quote generation failed: ${data.failure_reason}`);

      toast({ title: "Quotation generated!", description: `Quote ${data.quote?.quote_number} created successfully.` });

      if (addToPipeline) {
        await linkToPipeline(data.quote);
      }

      queryClient.invalidateQueries({ queryKey: ["archived-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["estimation_projects_for_quote"] });
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || "Could not generate quotation.";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Generate from uploaded files (full pipeline)
  const handleGenerateFromUpload = async () => {
    if (uploadFiles.length === 0) return;
    setGenerating(true);
    try {
      // 1. Upload files to storage and get public URLs
      const fileUrls: string[] = [];
      for (const file of uploadFiles) {
        const path = `estimation/${Date.now()}_${file.name}`;
        const { error } = await uploadToStorage("estimation-files", path, file);
        if (error) throw new Error(`Upload failed: ${file.name}`);
        const { data: urlData } = supabase.storage.from("estimation-files").getPublicUrl(path);
        fileUrls.push(urlData.publicUrl);
      }

      // 2. Run AI estimation
      const { data: estData, error: estError } = await supabase.functions.invoke("ai-estimate", {
        body: {
          name: projectName || "AI Auto Quotation",
          file_urls: fileUrls,
          waste_factor_pct: 15,
          customer_id: selectedCustomerId || undefined,
          lead_id: selectedLeadId || leadId || undefined,
        },
      });
      if (estError) {
        // supabase.functions.invoke swallows error bodies — try to get the message
        const errMsg = typeof estError === "object" && estError?.message ? estError.message : String(estError);
        throw new Error(errMsg);
      }
      if (estData?.error) throw new Error(estData.error);
      if (estData?.extraction_failed) throw new Error(estData.error || "Could not extract rebar data from the uploaded file.");

      const newProjectId = estData?.project?.id || estData?.project_id;
      if (!newProjectId) throw new Error("Estimation did not return a project ID");

      // Check if estimation produced meaningful data
      const estWeight = estData?.summary?.total_weight_kg ?? 0;
      if (estWeight <= 0) {
        throw new Error("No rebar data could be extracted from the uploaded file(s). Please ensure you're uploading a rebar schedule, shop drawing, or weight summary report.");
      }

      // 3. Generate quotation from the new project
      const { data: quoteData, error: quoteError } = await supabase.functions.invoke("ai-generate-quotation", {
        body: {
          estimation_project_id: newProjectId,
          lead_id: selectedLeadId || leadId || null,
          customer_name_override: customerName || null,
          delivery_distance_km: Number(deliveryDistance) || 0,
          include_shop_drawings: includeShopDrawings,
          scrap_percent: Number(scrapPercent) || 15,
        },
      });
      if (quoteError) throw quoteError;
      if (quoteData?.error) throw new Error(quoteData.error);
      if (quoteData?.failure_reason) throw new Error(quoteData.error || `Quote generation failed: ${quoteData.failure_reason}`);

      toast({ title: "Quotation generated!", description: `Quote ${quoteData.quote?.quote_number} created from uploaded files.` });

      if (addToPipeline) {
        await linkToPipeline(quoteData.quote);
      }

      queryClient.invalidateQueries({ queryKey: ["archived-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["estimation_projects_for_quote"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err?.message || "Could not generate quotation.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Link to pipeline
  const linkToPipeline = async (quote: any) => {
    if (!companyId) return;
    try {
      const targetLeadId = selectedLeadId || leadId;
      if (targetLeadId) {
        // Add activity to existing lead
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("sales_lead_activities").insert({
          sales_lead_id: targetLeadId,
          company_id: companyId,
          activity_type: "quotation",
          subject: `Quotation ${quote?.quote_number || ""} generated`,
          body: `AI-generated quotation. Total: $${Number(quote?.total || 0).toLocaleString()}`,
          user_id: user?.id || null,
          user_name: user?.email || "AI Auto",
        } as any);
      } else {
        // Create new lead
        await supabase.from("sales_leads").insert({
          company_id: companyId,
          title: `Quote ${quote?.quote_number || projectName || "New"}`,
          contact_name: customerName || quote?.customer_name || null,
          expected_value: quote?.total || null,
          source: "ai_quotation",
          stage: "new",
        });
      }
      toast({ title: "Added to pipeline", description: "Linked to sales pipeline successfully." });
    } catch {
      // Non-critical — don't fail the whole flow
      console.warn("Failed to link to pipeline");
    }
  };

  const handleGenerate = () => {
    if (tab === "project") handleGenerateFromProject();
    else handleGenerateFromUpload();
  };

  const isDisabled = generating || (tab === "project" ? !selectedProject : uploadFiles.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate AI Quotation
          </DialogTitle>
          <DialogDescription>
            Select an existing estimation project or upload files to auto-generate a professional quotation.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="project" className="flex-1">From Project</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">Upload Files</TabsTrigger>
          </TabsList>

          {/* Tab 1: Existing Project */}
          <TabsContent value="project" className="space-y-4 mt-3">
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
          </TabsContent>

          {/* Tab 2: Upload Files */}
          <TabsContent value="upload" className="space-y-4 mt-3">
            {/* Drag & drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop files here, paste, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Images, XLSX, CSV — max 4 files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* File chips */}
            {uploadFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadFiles.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs">
                    <FileText className="w-3 h-3" />
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Auto-generated from filename"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers || []).map((c: any) => (
                      <SelectItem key={c.customer_id} value={c.customer_id}>
                        {c.display_name || c.company_name || c.normalized_name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sales Lead</Label>
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {(leads || []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delivery & Shop Drawing options */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <Label htmlFor="delivery-km" className="text-sm">Delivery Distance (km)</Label>
            <Input
              id="delivery-km"
              type="number"
              min={0}
              placeholder="0 = no delivery"
              value={deliveryDistance}
              onChange={(e) => setDeliveryDistance(e.target.value)}
            />
          </div>
          <div className="flex items-end pb-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-shop-drawings"
                checked={includeShopDrawings}
                onCheckedChange={(v) => setIncludeShopDrawings(!!v)}
              />
              <Label htmlFor="include-shop-drawings" className="text-sm cursor-pointer">
                Include Shop Drawings
              </Label>
            </div>
          </div>
        </div>

        {/* Pipeline checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="add-pipeline"
            checked={addToPipeline}
            onCheckedChange={(v) => setAddToPipeline(!!v)}
          />
          <Label htmlFor="add-pipeline" className="text-sm cursor-pointer">
            Add to Sales Pipeline
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isDisabled} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Generating…" : "Generate with AI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
