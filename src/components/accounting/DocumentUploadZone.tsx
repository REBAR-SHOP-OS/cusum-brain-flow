import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Upload, FileText, Image, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ExtractedField {
  field: string;
  value: string | number | null;
  confidence: number;
}

interface ExtractionResult {
  documentType: string;
  overallConfidence: number;
  fields: ExtractedField[];
  warnings: string[];
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
}

interface Props {
  /** Which section is using this (hint for AI) */
  targetType?: string;
  /** Called when user confirms import with 100% or approves partial */
  onImport: (result: ExtractionResult) => void;
  /** Optional class */
  className?: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.csv,.xlsx,.xls";

export function DocumentUploadZone({ targetType, onImport, className }: Props) {
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (targetType) formData.append("targetType", targetType);

      const { data, error } = await supabase.functions.invoke("ai-document-import", {
        body: formData,
      });

      if (error) {
        let msg = "Analysis failed";
        try {
          const body = typeof error === "object" && "context" in error ? await (error as any).context?.json?.() : null;
          if (body?.error) msg = body.error;
        } catch { /* use fallback */ }
        toast({ title: "Import failed", description: msg, variant: "destructive" });
        setAnalyzing(false);
        return;
      }

      if (data?.error) {
        toast({ title: "Import failed", description: data.error, variant: "destructive" });
        setAnalyzing(false);
        return;
      }

      const extraction = data as ExtractionResult;
      setResult(extraction);

      if (extraction.overallConfidence === 100 && extraction.warnings.length === 0) {
        // Auto-import at 100% confidence with no warnings
        toast({
          title: "Auto-imported!",
          description: `${extraction.documentType} imported with 100% confidence.`,
        });
        onImport(extraction);
      } else {
        // Show review dialog
        setShowReview(true);
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [targetType, onImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFile(files[0]);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processFile(files[0]);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processFile]);

  const handleConfirm = () => {
    if (result) {
      onImport(result);
      setShowReview(false);
      setResult(null);
      toast({ title: "Imported!", description: "Document data imported successfully." });
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const getFieldValue = (fieldName: string) => {
    return result?.fields.find(f => f.field === fieldName);
  };

  return (
    <>
      {/* Drop zone */}
      <div
        className={`relative ${className || ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Card className={`border-2 border-dashed transition-colors ${
          dragging ? "border-primary bg-primary/5" :
          analyzing ? "border-warning bg-warning/5" :
          "border-muted-foreground/20 hover:border-primary/50"
        }`}>
          <CardContent className="p-4 flex items-center gap-3">
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-warning shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Analyzing {fileName}...</p>
                  <p className="text-xs text-muted-foreground">AI is extracting document data</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 shrink-0">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Drop files here or{" "}
                    <button
                      className="text-primary underline hover:text-primary/80"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, images, screenshots, CSV, Excel — AI auto-imports
                  </p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground/50 shrink-0">
                  <FileText className="w-4 h-4" />
                  <Image className="w-4 h-4" />
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Review Dialog for < 100% confidence */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Review Import — {result?.overallConfidence}% Confidence
            </DialogTitle>
            <DialogDescription>
              AI extracted the following data from <span className="font-medium">{fileName}</span>. Please review fields with low confidence.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Document type */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">{result.documentType}</Badge>
                <Badge className={`border-0 text-sm ${
                  result.overallConfidence === 100 ? "bg-success/10 text-success" :
                  result.overallConfidence >= 80 ? "bg-warning/10 text-warning" :
                  "bg-destructive/10 text-destructive"
                }`}>
                  {result.overallConfidence}% confidence
                </Badge>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-warning flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Fields */}
              <div className="space-y-2">
                {result.fields.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      {f.confidence === 100 ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <AlertTriangle className={`w-4 h-4 shrink-0 ${f.confidence >= 80 ? "text-warning" : "text-destructive"}`} />
                      )}
                      <span className="text-sm text-muted-foreground capitalize">{f.field.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {typeof f.value === "number" && f.field.includes("amount") ? fmt(f.value) : String(f.value ?? "—")}
                      </span>
                      <Badge variant="outline" className={`text-xs ${
                        f.confidence === 100 ? "text-success border-success/30" :
                        f.confidence >= 80 ? "text-warning border-warning/30" :
                        "text-destructive border-destructive/30"
                      }`}>
                        {f.confidence}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Line items */}
              {result.lineItems && result.lineItems.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Line Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-left">
                          <th className="p-2">Description</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Price</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.lineItems.map((li, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{li.description}</td>
                            <td className="p-2 text-right">{li.quantity}</td>
                            <td className="p-2 text-right">{fmt(li.unitPrice)}</td>
                            <td className="p-2 text-right font-medium">{fmt(li.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowReview(false); setResult(null); }}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleConfirm}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
