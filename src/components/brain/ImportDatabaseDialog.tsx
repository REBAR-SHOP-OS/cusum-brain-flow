import { useState, useRef } from "react";
import { X, Database, Upload, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

interface ImportDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRow {
  title: string;
  content?: string;
  category?: string;
  source_url?: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const titleIdx = headers.findIndex((h) => ["title", "name", "label", "key"].includes(h));
  const contentIdx = headers.findIndex((h) => ["content", "value", "description", "body", "text", "note", "notes"].includes(h));
  const categoryIdx = headers.findIndex((h) => ["category", "type", "kind", "tag"].includes(h));
  const urlIdx = headers.findIndex((h) => ["url", "source_url", "link", "source"].includes(h));

  if (titleIdx === -1 && contentIdx === -1) return [];

  return lines.slice(1).map((line) => {
    // Simple CSV parse (handles basic quoting)
    const cols: string[] = [];
    let current = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { cols.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cols.push(current.trim());

    return {
      title: cols[titleIdx] || cols[0] || "Untitled",
      content: contentIdx >= 0 ? cols[contentIdx] : undefined,
      category: categoryIdx >= 0 ? cols[categoryIdx] : "memory",
      source_url: urlIdx >= 0 ? cols[urlIdx] : undefined,
    };
  }).filter((r) => r.title && r.title !== "Untitled");
}

function parseJSON(text: string): ParsedRow[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.records || data.data || data.items || data.rows || [];
  if (!Array.isArray(arr)) return [];

  return arr.map((item: Record<string, unknown>) => ({
    title: String(item.title || item.name || item.label || item.key || "Untitled"),
    content: item.content || item.value || item.description || item.body || item.text
      ? String(item.content || item.value || item.description || item.body || item.text)
      : undefined,
    category: item.category ? String(item.category) : "memory",
    source_url: item.url || item.source_url || item.link
      ? String(item.url || item.source_url || item.link)
      : undefined,
  })).filter((r: ParsedRow) => r.title !== "Untitled");
}

export function ImportDatabaseDialog({ open, onOpenChange, onSuccess }: ImportDatabaseDialogProps) {
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { companyId } = useCompanyId();
  const { toast } = useToast();

  if (!open) return null;

  const reset = () => {
    setParsedRows(null);
    setFileName("");
    setError("");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: ParsedRow[];

      if (ext === "json") {
        rows = parseJSON(text);
      } else {
        rows = parseCSV(text);
      }

      if (rows.length === 0) {
        setError("No valid rows found. Make sure your file has a 'title' or 'name' column.");
        return;
      }

      setParsedRows(rows);
      setFileName(file.name);
    } catch {
      setError("Failed to parse file. Please check the format.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!parsedRows || !companyId) return;
    setImporting(true);

    try {
      const BATCH = 50;
      let imported = 0;

      for (let i = 0; i < parsedRows.length; i += BATCH) {
        const batch = parsedRows.slice(i, i + BATCH).map((r) => ({
          title: r.title.slice(0, 255),
          content: r.content || null,
          category: r.category || "memory",
          source_url: r.source_url || null,
          company_id: companyId,
        }));

        const { error: insertError } = await supabase.from("knowledge").insert(batch);
        if (insertError) throw insertError;
        imported += batch.length;
      }

      toast({ title: `Imported ${imported} items to Brain` });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="w-full sm:max-w-lg max-h-[85vh] bg-card rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Import Database</h2>
          </div>
          <button onClick={() => { reset(); onOpenChange(false); }} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {!parsedRows ? (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a <strong>CSV</strong> or <strong>JSON</strong> file to bulk-import knowledge entries into Brain.
              </p>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground text-sm">Expected columns:</p>
                <p><code className="bg-muted px-1 rounded">title</code> or <code className="bg-muted px-1 rounded">name</code> — <span className="text-destructive">required</span></p>
                <p><code className="bg-muted px-1 rounded">content</code> / <code className="bg-muted px-1 rounded">description</code> — optional details</p>
                <p><code className="bg-muted px-1 rounded">category</code> — memory, image, video, webpage, document</p>
                <p><code className="bg-muted px-1 rounded">url</code> — optional source link</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.txt"
                onChange={handleFile}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full flex flex-col items-center gap-2 p-8 border-2 border-dashed border-border rounded-xl",
                  "hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                )}
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium">Click to upload CSV or JSON</span>
                <span className="text-xs text-muted-foreground">Supports .csv, .json files</span>
              </button>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{parsedRows.length} entries found</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>Change</Button>
              </div>

              {/* Preview */}
              <div className="space-y-1">
                <Label>Preview (first 5 rows)</Label>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto divide-y divide-border">
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <p className="font-medium truncate">{row.title}</p>
                        {row.content && <p className="text-muted-foreground line-clamp-1 mt-0.5">{row.content}</p>}
                        <div className="flex gap-2 mt-1 text-muted-foreground/70">
                          {row.category && <span className="bg-muted px-1.5 py-0.5 rounded">{row.category}</span>}
                          {row.source_url && <span className="truncate">{row.source_url}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {parsedRows.length > 5 && (
                  <p className="text-xs text-muted-foreground">...and {parsedRows.length - 5} more</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleImport}
            disabled={!parsedRows || importing || !companyId}
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Import {parsedRows ? `${parsedRows.length} items` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
