import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload, FileText, Calculator, AlertTriangle, Download,
  Weight, DollarSign, Clock, Percent, Plus, ArrowRight
} from "lucide-react";

type EstimationProject = {
  id: string;
  name: string;
  status: string;
  total_weight_kg: number;
  total_cost: number;
  labor_hours: number;
  waste_factor_pct: number;
  element_summary: Record<string, number>;
  created_at: string;
};

type EstimationItem = {
  id: string;
  element_type: string;
  element_ref: string;
  mark: string;
  bar_size: string;
  quantity: number;
  cut_length_mm: number;
  total_length_mm: number;
  hook_allowance_mm: number;
  lap_allowance_mm: number;
  weight_kg: number;
  unit_cost: number;
  line_cost: number;
  warnings: string[];
  source: string;
};

export default function Estimation() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("new");
  const [projectName, setProjectName] = useState("");
  const [scopeContext, setScopeContext] = useState("");
  const [wasteFactor, setWasteFactor] = useState(5);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);

  // Fetch past projects
  const { data: projects = [] } = useQuery({
    queryKey: ["estimation_projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimation_projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as EstimationProject[];
    },
    enabled: !!companyId,
  });

  // Fetch items for selected project
  const { data: items = [] } = useQuery({
    queryKey: ["estimation_items", selectedProject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimation_items")
        .select("*")
        .eq("project_id", selectedProject!)
        .order("element_type", { ascending: true });
      if (error) throw error;
      return data as EstimationItem[];
    },
    enabled: !!selectedProject,
  });

  // Upload files
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `estimation/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("estimation-files")
        .upload(path, file);
      if (error) {
        toast.error(`Upload failed: ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("estimation-files")
        .getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    setFileUrls((prev) => [...prev, ...urls]);
    setUploading(false);
    toast.success(`${urls.length} file(s) uploaded`);
  }, []);

  // Run takeoff
  const takeoffMutation = useMutation({
    mutationFn: async () => {
      setPipelineStage("uploading");
      await new Promise((r) => setTimeout(r, 500));
      setPipelineStage("ocr");
      await new Promise((r) => setTimeout(r, 500));
      setPipelineStage("extraction");

      const { data, error } = await supabase.functions.invoke("ai-estimate", {
        body: {
          name: projectName,
          file_urls: fileUrls,
          waste_factor_pct: wasteFactor,
          scope_context: scopeContext,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPipelineStage("complete");
      setSelectedProject(data.project_id);
      setActiveTab("results");
      queryClient.invalidateQueries({ queryKey: ["estimation_projects"] });
      toast.success(
        `Takeoff complete: ${data.summary?.item_count ?? 0} items, ${data.summary?.total_weight_kg ?? 0} kg`
      );
      // Reset form
      setProjectName("");
      setScopeContext("");
      setFileUrls([]);
      setTimeout(() => setPipelineStage(null), 2000);
    },
    onError: (err: Error) => {
      setPipelineStage(null);
      toast.error(`Estimation failed: ${err.message}`);
    },
  });

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const allWarnings = items.flatMap((i) => i.warnings ?? []);

  const pipelineProgress = {
    uploading: 15,
    ocr: 35,
    extraction: 60,
    calculation: 80,
    complete: 100,
  }[pipelineStage ?? ""] ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rebar Estimation</h1>
          <p className="text-muted-foreground text-sm">
            AI-powered takeoff from structural drawings
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new">New Takeoff</TabsTrigger>
          <TabsTrigger value="results">
            Results {selectedProjectData && <Badge variant="secondary" className="ml-1">{items.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">
            History <Badge variant="outline" className="ml-1">{projects.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ─── New Takeoff ─── */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Upload Drawings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Project Name</Label>
                <Input
                  placeholder="e.g. 20 York St - Foundation"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div>
                <Label>Scope / Context (optional)</Label>
                <Textarea
                  placeholder="e.g. Estimate columns C1-C12 and footings F1-F8 only"
                  value={scopeContext}
                  onChange={(e) => setScopeContext(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label>Waste Factor (%)</Label>
                <Input
                  type="number"
                  value={wasteFactor}
                  onChange={(e) => setWasteFactor(Number(e.target.value))}
                  min={0}
                  max={20}
                  className="w-32"
                />
              </div>

              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="estimation-upload"
                  disabled={uploading}
                />
                <label htmlFor="estimation-upload" className="cursor-pointer">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {uploading ? "Uploading..." : "Drop structural drawings here or click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, TIFF</p>
                </label>
              </div>

              {fileUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fileUrls.map((url, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      File {i + 1}
                    </Badge>
                  ))}
                </div>
              )}

              {pipelineStage && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calculator className="h-4 w-4 animate-spin" />
                    {pipelineStage === "uploading" && "Uploading files..."}
                    {pipelineStage === "ocr" && "Running OCR on drawings..."}
                    {pipelineStage === "extraction" && "AI extracting rebar data..."}
                    {pipelineStage === "calculation" && "Computing weights & costs..."}
                    {pipelineStage === "complete" && "✅ Complete!"}
                  </div>
                  <Progress value={pipelineProgress} className="h-2" />
                </div>
              )}

              <Button
                onClick={() => takeoffMutation.mutate()}
                disabled={!projectName || fileUrls.length === 0 || takeoffMutation.isPending}
                className="w-full"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {takeoffMutation.isPending ? "Running Takeoff..." : "Run AI Takeoff"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Results ─── */}
        <TabsContent value="results" className="space-y-4">
          {selectedProjectData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Weight className="h-4 w-4" /> Total Weight
                    </div>
                    <p className="text-xl font-bold mt-1">
                      {selectedProjectData.total_weight_kg.toLocaleString()} kg
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <DollarSign className="h-4 w-4" /> Total Cost
                    </div>
                    <p className="text-xl font-bold mt-1">
                      ${selectedProjectData.total_cost.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" /> Labor Hours
                    </div>
                    <p className="text-xl font-bold mt-1">
                      {selectedProjectData.labor_hours}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Percent className="h-4 w-4" /> Waste Factor
                    </div>
                    <p className="text-xl font-bold mt-1">
                      {selectedProjectData.waste_factor_pct}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Warnings */}
              {allWarnings.length > 0 && (
                <Card className="border-destructive/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">{allWarnings.length} Warning(s)</span>
                    </div>
                    <ul className="text-sm space-y-1">
                      {allWarnings.slice(0, 10).map((w, i) => (
                        <li key={i} className="text-muted-foreground">• {w}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Items Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Estimation Items ({items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">Element</th>
                        <th className="p-2">Ref</th>
                        <th className="p-2">Mark</th>
                        <th className="p-2">Bar</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Cut (mm)</th>
                        <th className="p-2 text-right">Total (mm)</th>
                        <th className="p-2 text-right">Weight (kg)</th>
                        <th className="p-2 text-right">Cost ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="p-2 capitalize">{item.element_type}</td>
                          <td className="p-2">{item.element_ref}</td>
                          <td className="p-2">{item.mark}</td>
                          <td className="p-2">
                            <Badge variant="outline">{item.bar_size}</Badge>
                          </td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{item.cut_length_mm?.toLocaleString()}</td>
                          <td className="p-2 text-right">{item.total_length_mm?.toLocaleString()}</td>
                          <td className="p-2 text-right">{item.weight_kg?.toFixed(2)}</td>
                          <td className="p-2 text-right">${item.line_cost?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
                <Button variant="outline" size="sm">
                  <ArrowRight className="h-4 w-4 mr-1" /> Convert to Quote
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Run a takeoff or select a project from History to view results.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── History ─── */}
        <TabsContent value="history" className="space-y-2">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No estimation projects yet. Run your first takeoff!
              </CardContent>
            </Card>
          ) : (
            projects.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setSelectedProject(p.id);
                  setActiveTab("results");
                }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()} · {p.total_weight_kg.toLocaleString()} kg · ${p.total_cost.toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={p.status === "completed" ? "default" : "secondary"}>
                    {p.status}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
