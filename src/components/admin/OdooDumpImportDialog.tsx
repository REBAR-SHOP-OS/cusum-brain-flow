import { useCallback, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload, FolderOpen, CheckCircle, AlertTriangle, XCircle, FileText, FileArchive,
} from "lucide-react";
import { BlobReader, BlobWriter, ZipReader, type Entry } from "@zip.js/zip.js";

/* ── types ── */
interface MappingRow {
  id: number;
  store_fname: string;
  name: string;
  mimetype: string;
}

interface PendingFile {
  odoo_id: number;
  lead_id: string;
  file_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const BATCH = 5;

export function OdooDumpImportDialog({ open, onOpenChange }: Props) {
  const [mapping, setMapping] = useState<MappingRow[]>([]);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [step, setStep] = useState<1 | 2>(1);

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const abortRef = useRef(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  /* ── Step 1: parse CSV ── */
  const handleCsvUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split("\n");
    const header = lines[0].toLowerCase();
    if (!header.includes("id") || !header.includes("store_fname")) {
      toast.error("CSV must have columns: id, store_fname, name, mimetype");
      return;
    }
    const rows: MappingRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 4) continue;
      rows.push({
        id: parseInt(cols[0], 10),
        store_fname: cols[1].trim(),
        name: cols[2].trim(),
        mimetype: cols[3].trim(),
      });
    }
    setMapping(rows);

    const { data, error } = await supabase
      .from("lead_files")
      .select("odoo_id, lead_id, file_name")
      .not("odoo_id", "is", null)
      .is("storage_path", null);

    if (error) {
      toast.error("Failed to fetch pending files");
      return;
    }
    const pendingRows = (data ?? []) as unknown as PendingFile[];
    setPending(pendingRows);

    const matchCount = pendingRows.filter((p) =>
      rows.some((m) => m.id === p.odoo_id)
    ).length;

    toast.success(`Mapping loaded: ${rows.length} entries, ${matchCount} match pending files`);
  }, []);

  /* ── shared upload helper ── */
  const processQueue = useCallback(
    async (queue: { pending: PendingFile; mapping: MappingRow; getBlob: () => Promise<Blob> }[]) => {
      toast.info(`Starting upload of ${queue.length} files…`);
      setUploading(true);
      setUploaded(0);
      setFailed(0);
      setErrors([]);
      abortRef.current = false;

      let ok = 0;
      let fail = 0;
      const errs: string[] = [];

      for (let i = 0; i < queue.length; i += BATCH) {
        if (abortRef.current) break;
        const batch = queue.slice(i, i + BATCH);

        await Promise.all(
          batch.map(async ({ pending: p, mapping: m, getBlob }) => {
            try {
              const blob = await getBlob();
              const storagePath = `odoo-archive/${p.lead_id}/${p.odoo_id}-${m.name}`;
              const { error: upErr } = await supabase.storage
                .from("estimation-files")
                .upload(storagePath, blob, {
                  contentType: m.mimetype || "application/octet-stream",
                  upsert: true,
                });
              if (upErr) throw upErr;

              const { error: dbErr } = await supabase
                .from("lead_files")
                .update({
                  storage_path: storagePath,
                  file_url: storagePath,
                } as any)
                .eq("odoo_id", p.odoo_id)
                .is("storage_path", null);
              if (dbErr) throw dbErr;

              ok++;
            } catch (err: any) {
              fail++;
              errs.push(`${m.name}: ${err?.message ?? "unknown"}`);
            }
          })
        );
        setUploaded(ok);
        setFailed(fail);
        setErrors([...errs]);
      }

      setUploading(false);
      toast.success(`Import complete: ${ok} uploaded, ${fail} failed`);
    },
    []
  );

  /* ── Step 2a: folder upload ── */
  const handleFolderSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const fileMap = new Map<string, File>();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const rel = f.webkitRelativePath;
        const idx = rel.indexOf("/");
        if (idx >= 0) fileMap.set(rel.slice(idx + 1), f);
      }

      const mappingById = new Map<number, MappingRow>();
      mapping.forEach((m) => mappingById.set(m.id, m));

      const queue = pending
        .map((p) => {
          const m = mappingById.get(p.odoo_id);
          if (!m) return null;
          const file = fileMap.get(m.store_fname);
          if (!file) return null;
          return { pending: p, mapping: m, getBlob: () => Promise.resolve(file as Blob) };
        })
        .filter(Boolean) as { pending: PendingFile; mapping: MappingRow; getBlob: () => Promise<Blob> }[];

      if (queue.length === 0) {
        toast.error("No matching files found in the selected folder");
        return;
      }
      await processQueue(queue);
    },
    [mapping, pending, processQueue]
  );

  /* ── Step 2b: ZIP file upload ── */
  const handleZipSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      toast.info("Scanning ZIP file…");

      const mappingById = new Map<number, MappingRow>();
      mapping.forEach((m) => mappingById.set(m.id, m));

      // Build a set of store_fname we actually need
      const neededFnames = new Map<string, { pending: PendingFile; mapping: MappingRow }>();
      for (const p of pending) {
        const m = mappingById.get(p.odoo_id);
        if (m) neededFnames.set(m.store_fname, { pending: p, mapping: m });
      }

      const reader = new ZipReader(new BlobReader(file));
      const entries = await reader.getEntries();

      // Build queue by matching ZIP entry filenames to store_fname
      const queue: { pending: PendingFile; mapping: MappingRow; getBlob: () => Promise<Blob> }[] = [];

      for (const entry of entries) {
        if (entry.directory) continue;
        // ZIP path might be like "filestore/ab/ab12cd34..." or just "ab/ab12cd34..."
        const fname = entry.filename;
        // Try matching after "filestore/" prefix or the raw path
        const filestoreIdx = fname.indexOf("filestore/");
        const relPath = filestoreIdx >= 0 ? fname.slice(filestoreIdx + "filestore/".length) : fname;

        const match = neededFnames.get(relPath);
        if (match) {
          const capturedEntry = entry;
          queue.push({
            pending: match.pending,
            mapping: match.mapping,
            getBlob: async () => (capturedEntry as any).getData(new BlobWriter()),
          });
        }
      }

      if (queue.length === 0) {
        toast.error("No matching files found in the ZIP");
        await reader.close();
        return;
      }

      toast.success(`Found ${queue.length} matching files in ZIP`);
      await processQueue(queue);
      await reader.close();
    },
    [mapping, pending, processQueue]
  );

  const total = pending.filter((p) => mapping.some((m) => m.id === p.odoo_id)).length;
  const pct = total > 0 ? Math.round((uploaded / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Import from Odoo Dump
          </DialogTitle>
          <DialogDescription>
            Upload files directly from your downloaded Odoo dump — no API needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-semibold">
              <Badge variant="outline">1</Badge> Upload Mapping CSV
            </Label>
            <p className="text-xs text-muted-foreground">
              Extract from your dump SQL:{" "}
              <code className="bg-muted px-1 rounded text-[10px]">
                COPY (SELECT id, store_fname, name, mimetype FROM ir_attachment WHERE res_model='crm.lead') TO '/tmp/mapping.csv' CSV HEADER;
              </code>
            </p>
            <Input type="file" accept=".csv" onChange={handleCsvUpload} />
            {mapping.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {mapping.length} mappings loaded • {total} match pending files
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => setStep(2)}>
                  Next →
                </Button>
              </div>
            )}
          </div>

          {/* Step 2 */}
          {(step === 2 || uploading || uploaded > 0) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold">
                <Badge variant="outline">2</Badge> Select Dump Source
              </Label>

              <Tabs defaultValue="zip" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="zip" className="flex-1 gap-1">
                    <FileArchive className="h-3.5 w-3.5" /> ZIP File
                  </TabsTrigger>
                  <TabsTrigger value="folder" className="flex-1 gap-1">
                    <FolderOpen className="h-3.5 w-3.5" /> Extracted Folder
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="zip" className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Select the Odoo dump <code className="bg-muted px-1 rounded">.zip</code> file directly — no extraction needed.
                  </p>
                  <Input type="file" accept=".zip" disabled={uploading} onChange={handleZipSelect} />
                </TabsContent>

                <TabsContent value="folder" className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Select the <code className="bg-muted px-1 rounded">filestore/</code> folder from your extracted dump.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => folderInputRef.current?.click()}
                      className="gap-1"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Choose Folder
                    </Button>
                  </div>
                  <input
                    ref={folderInputRef}
                    type="file"
                    className="hidden"
                    {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
                    onChange={handleFolderSelect}
                  />
                </TabsContent>
              </Tabs>

              {/* Abort button */}
              {uploading && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { abortRef.current = true; }}
                  className="gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" /> Abort
                </Button>
              )}

              {/* Progress */}
              {(uploading || uploaded > 0) && (
                <div className="space-y-2">
                  <Progress value={pct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {uploaded} / {total}
                    </span>
                    {failed > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {failed} failed
                      </span>
                    )}
                    <span>{pct}%</span>
                  </div>
                  {errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {errors.slice(0, 20).map((err, i) => (
                        <div key={i} className="text-[10px] bg-destructive/10 text-destructive rounded px-2 py-0.5 font-mono break-all">
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
