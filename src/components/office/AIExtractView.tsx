import { useState, useRef } from "react";
import {
  Upload, Globe, FileText, Loader2, Truck, Package,
  CheckCircle2, AlertCircle, Sparkles, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExtractedItem {
  dwg?: string;
  item?: string | number;
  grade?: string;
  mark?: string;
  quantity?: number;
  size?: string;
  type?: string;
  total_length?: number;
  A?: number | null;
  B?: number | null;
  C?: number | null;
  D?: number | null;
  E?: number | null;
  F?: number | null;
  G?: number | null;
  H?: number | null;
  J?: number | null;
  K?: number | null;
  O?: number | null;
  R?: number | null;
  weight?: number | null;
  customer?: string;
  ref?: string;
  address?: string;
}

interface ExtractionResult {
  items: ExtractedItem[];
  summary?: {
    total_items?: number;
    total_pieces?: number;
    bar_sizes_found?: string[];
    shape_types_found?: string[];
    customer?: string;
    project?: string;
  };
}

type ManifestType = "delivery" | "pickup";

export function AIExtractView() {
  const [manifestName, setManifestName] = useState("");
  const [customer, setCustomer] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [targetEta, setTargetEta] = useState("");
  const [manifestType, setManifestType] = useState<ManifestType>("delivery");

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setExtractionResult(null);
    setExtractionError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setExtractionResult(null);
    setExtractionError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = () => {
    setUploadedFile(null);
    setExtractionResult(null);
    setExtractionError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = async () => {
    if (!uploadedFile) return;

    setIsUploading(true);
    setIsExtracting(false);
    setExtractionError(null);

    try {
      // 1. Upload to storage
      const ext = uploadedFile.name.split(".").pop()?.toLowerCase() || "bin";
      const storagePath = `manifests/${Date.now()}_${uploadedFile.name.replace(/\s+/g, "_")}`;

      const { error: uploadErr } = await supabase.storage
        .from("estimation-files")
        .upload(storagePath, uploadedFile, {
          upsert: true,
          contentType: uploadedFile.type,
        });

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/estimation-files/${storagePath}`;

      setIsUploading(false);
      setIsExtracting(true);

      // 2. Call AI extraction edge function
      const { data, error } = await supabase.functions.invoke("extract-manifest", {
        body: {
          fileUrl: publicUrl,
          fileName: uploadedFile.name,
          manifestContext: {
            name: manifestName,
            customer,
            address: siteAddress,
            type: manifestType,
          },
        },
      });

      if (error) throw new Error(error.message || "Extraction failed");

      if (data?.error) {
        throw new Error(data.error);
      }

      setExtractionResult(data as ExtractionResult);

      // Auto-fill form fields from extraction if they're empty
      if (data?.summary) {
        if (!customer && data.summary.customer) setCustomer(data.summary.customer);
        if (!manifestName && data.summary.project) setManifestName(data.summary.project);
      }

      toast({
        title: "Extraction complete",
        description: `Found ${data?.items?.length || 0} items across ${data?.summary?.bar_sizes_found?.length || 0} bar sizes`,
      });
    } catch (err: any) {
      console.error("Processing error:", err);
      setExtractionError(err.message);
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const dimCols = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

  return (
    <div className="p-6 space-y-6 max-w-[95vw] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black italic text-foreground uppercase">Initialize Manifest</h1>
            <p className="text-xs tracking-widest text-primary/70 uppercase">Identity Registration</p>
          </div>
        </div>

        {/* Delivery / Pickup toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={manifestType === "delivery" ? "default" : "ghost"}
            size="sm"
            className="h-9 px-4 text-xs gap-1.5 font-bold"
            onClick={() => setManifestType("delivery")}
          >
            <Truck className="w-3.5 h-3.5" /> DELIVERY
          </Button>
          <Button
            variant={manifestType === "pickup" ? "default" : "ghost"}
            size="sm"
            className="h-9 px-4 text-xs gap-1.5 font-bold"
            onClick={() => setManifestType("pickup")}
          >
            <Package className="w-3.5 h-3.5" /> PICKUP
          </Button>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Manifest Name
          </label>
          <Input
            value={manifestName}
            onChange={(e) => setManifestName(e.target.value)}
            className="bg-card border-border"
            placeholder="e.g. 23 HALFORD ROAD - HAB (3)"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Customer
          </label>
          <Input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="bg-card border-border"
            placeholder="e.g. ACME CONCRETE"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Site Address
          </label>
          <Input
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
            className="bg-card border-border"
            placeholder="e.g. 123 MAIN ST"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Target ETA
          </label>
          <Input
            type="date"
            value={targetEta}
            onChange={(e) => setTargetEta(e.target.value)}
            className="bg-card border-border"
          />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload area or file preview */}
      {!uploadedFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-border rounded-xl p-16 flex flex-col items-center justify-center gap-4 bg-muted/20 hover:border-primary/40 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Upload className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-black italic text-foreground uppercase">Upload Drawing Ledger</h2>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">
            PDF · Spreadsheet (XLSX/CSV) · Image (PNG/JPG) · Any File
          </p>
          <div className="flex items-center gap-6 mt-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="w-4 h-4" />
              <span className="tracking-widest uppercase">Identity Mapping</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="tracking-widest uppercase">Raw Integrity</span>
            </span>
          </div>
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadedFile.size / 1024).toFixed(1)} KB · {uploadedFile.type || "unknown type"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isUploading && !isExtracting && !extractionResult && (
                  <Button onClick={processFile} className="gap-1.5">
                    <Sparkles className="w-4 h-4" /> Extract & Map
                  </Button>
                )}
                {(isUploading || isExtracting) && (
                  <Badge variant="secondary" className="gap-1.5 text-xs py-1.5 px-3">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {isUploading ? "Uploading..." : "AI Extracting..."}
                  </Badge>
                )}
                {extractionResult && (
                  <Badge className="gap-1.5 text-xs py-1.5 px-3 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0">
                    <CheckCircle2 className="w-3 h-3" />
                    {extractionResult.items?.length || 0} items extracted
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={removeFile} disabled={isUploading || isExtracting}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {extractionError && (
              <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {extractionError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extraction Results Summary */}
      {extractionResult?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-foreground">{extractionResult.summary.total_items || extractionResult.items?.length || 0}</p>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Line Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-foreground">{extractionResult.summary.total_pieces || 0}</p>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Total Pieces</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex flex-wrap gap-1 justify-center">
                {extractionResult.summary.bar_sizes_found?.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                ))}
              </div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mt-1">Bar Sizes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex flex-wrap gap-1 justify-center">
                {extractionResult.summary.shape_types_found?.slice(0, 6).map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
                {(extractionResult.summary.shape_types_found?.length || 0) > 6 && (
                  <Badge variant="outline" className="text-[10px]">+{(extractionResult.summary.shape_types_found?.length || 0) - 6}</Badge>
                )}
              </div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mt-1">Shape Types</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Extraction Results Table */}
      {extractionResult?.items && extractionResult.items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-bold tracking-wider w-[60px]">DWG#</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider w-[40px]">#</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider w-[60px]">GRADE</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider w-[80px]">MARK</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider w-[40px] text-center">QTY</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider w-[50px]">SIZE</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider w-[50px]">TYPE</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider w-[70px] text-right">LENGTH</TableHead>
                    {dimCols.map((d) => (
                      <TableHead key={d} className="text-[10px] font-bold tracking-wider w-[50px] text-right">{d}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractionResult.items.map((item, i) => (
                    <TableRow key={i} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-mono">{item.dwg || "—"}</TableCell>
                      <TableCell className="text-xs">{item.item || i + 1}</TableCell>
                      <TableCell className="text-xs">{item.grade || "—"}</TableCell>
                      <TableCell className="text-xs font-bold text-primary">{item.mark || "—"}</TableCell>
                      <TableCell className="text-xs text-center font-bold">{item.quantity ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-[10px] font-bold">{item.size || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.type ? (
                          <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">STR</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">{item.total_length ?? "—"}</TableCell>
                      {dimCols.map((d) => (
                        <TableCell key={d} className="text-xs text-right font-mono text-muted-foreground">
                          {item[d] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
