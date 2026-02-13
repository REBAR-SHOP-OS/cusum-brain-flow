import { useCallback, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload, CheckCircle, AlertTriangle, XCircle, FileArchive,
} from "lucide-react";
import { BlobReader, BlobWriter, TextWriter, ZipReader } from "@zip.js/zip.js";

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

/** Parse ir_attachment rows from Odoo dump.sql COPY block */
function parseMappingFromSql(sql: string): MappingRow[] {
  // Find the COPY block for ir_attachment
  // Format: COPY public.ir_attachment (id, ..., store_fname, ..., name, ..., mimetype, ...) FROM stdin;
  const copyMatch = sql.match(
    /COPY public\.ir_attachment\s*\(([^)]+)\)\s*FROM stdin;/i
  );
  if (!copyMatch) return [];

  const columns = copyMatch[1].split(",").map((c) => c.trim().toLowerCase());
  const idIdx = columns.indexOf("id");
  const storeFnameIdx = columns.indexOf("store_fname");
  const nameIdx = columns.indexOf("name");
  const mimetypeIdx = columns.indexOf("mimetype");
  const resModelIdx = columns.indexOf("res_model");

  if (idIdx < 0 || storeFnameIdx < 0 || nameIdx < 0 || mimetypeIdx < 0) return [];

  // Extract lines between the COPY header and the terminating \. 
  const startIdx = sql.indexOf("\n", sql.indexOf(copyMatch[0])) + 1;
  const endMarker = "\n\\.\n";
  const endIdx = sql.indexOf(endMarker, startIdx);
  if (endIdx < 0) return [];

  const block = sql.slice(startIdx, endIdx);
  const rows: MappingRow[] = [];

  for (const line of block.split("\n")) {
    if (!line || line === "\\.") break;
    const cols = line.split("\t");
    // Filter to crm.lead only
    if (resModelIdx >= 0 && cols[resModelIdx] !== "crm.lead") continue;
    const storeFname = cols[storeFnameIdx];
    if (!storeFname || storeFname === "\\N") continue;

    rows.push({
      id: parseInt(cols[idIdx], 10),
      store_fname: storeFname,
      name: cols[nameIdx] || "",
      mimetype: cols[mimetypeIdx] || "application/octet-stream",
    });
  }
  return rows;
}

export function OdooDumpImportDialog({ open, onOpenChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const abortRef = useRef(false);

  /* ── shared upload helper ── */
  const processQueue = useCallback(
    async (queue: { pending: PendingFile; mapping: MappingRow; getBlob: () => Promise<Blob> }[]) => {
      toast.info(`Starting upload of ${queue.length} files…`);
      setTotal(queue.length);
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
              const safeName = m.name.replace(/[~#%&{}\\<>*?/$!'":@+`|=]/g, "_");
              const storagePath = `odoo-archive/${p.lead_id}/${p.odoo_id}-${safeName}`;
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
      setStatusMsg(`Import complete: ${ok} uploaded, ${fail} failed`);
      toast.success(`Import complete: ${ok} uploaded, ${fail} failed`);
    },
    []
  );

  /* ── Single ZIP handler: extract mapping from dump.sql + match filestore ── */
  const handleZipSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setStatusMsg("Opening ZIP…");
      const reader = new ZipReader(new BlobReader(file));
      const entries = await reader.getEntries();

      // 1. Find dump.sql and extract mapping
      setStatusMsg("Looking for dump.sql…");
      const dumpEntry = entries.find((e) => e.filename.endsWith("dump.sql") && !e.directory);
      if (!dumpEntry) {
        toast.error("No dump.sql found in the ZIP");
        await reader.close();
        return;
      }

      setStatusMsg("Parsing ir_attachment from dump.sql (this may take a moment)…");
      const sqlText = await (dumpEntry as any).getData(new TextWriter());
      const mapping = parseMappingFromSql(sqlText);

      if (mapping.length === 0) {
        toast.error("No ir_attachment rows for crm.lead found in dump.sql");
        await reader.close();
        return;
      }
      toast.success(`Found ${mapping.length} attachment mappings in dump.sql`);

      // 2. Fetch pending files from DB
      setStatusMsg("Fetching pending files from database…");
      const { data, error } = await supabase
        .from("lead_files")
        .select("odoo_id, lead_id, file_name")
        .not("odoo_id", "is", null)
        .is("storage_path", null);

      if (error) {
        toast.error("Failed to fetch pending files");
        await reader.close();
        return;
      }
      const pending = (data ?? []) as unknown as PendingFile[];

      // 3. Build lookup and match
      const mappingById = new Map<number, MappingRow>();
      mapping.forEach((m) => mappingById.set(m.id, m));

      const neededFnames = new Map<string, { pending: PendingFile; mapping: MappingRow }>();
      for (const p of pending) {
        const m = mappingById.get(p.odoo_id);
        if (m) neededFnames.set(m.store_fname, { pending: p, mapping: m });
      }

      setStatusMsg("Matching filestore entries…");
      const queue: { pending: PendingFile; mapping: MappingRow; getBlob: () => Promise<Blob> }[] = [];

      for (const entry of entries) {
        if (entry.directory) continue;
        const fname = entry.filename;
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
        toast.error(`No matching files found (${pending.length} pending, ${mapping.length} mappings)`);
        await reader.close();
        return;
      }

      toast.success(`Found ${queue.length} matching files in ZIP`);
      await processQueue(queue);
      await reader.close();
    },
    [processQueue]
  );

  const pct = total > 0 ? Math.round((uploaded / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Import from Odoo Dump
          </DialogTitle>
          <DialogDescription>
            Select your Odoo dump ZIP file — it will auto-extract the mapping from dump.sql and upload matching files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-semibold">
              <FileArchive className="h-4 w-4" /> Select Odoo Dump ZIP
            </Label>
            <p className="text-xs text-muted-foreground">
              The ZIP should contain <code className="bg-muted px-1 rounded">dump.sql</code> and a{" "}
              <code className="bg-muted px-1 rounded">filestore/</code> folder.
            </p>
            <Input type="file" accept=".zip" disabled={uploading} onChange={handleZipSelect} />
          </div>

          {statusMsg && !uploading && uploaded === 0 && (
            <p className="text-xs text-muted-foreground italic">{statusMsg}</p>
          )}

          {/* Abort button */}
          {uploading && (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { abortRef.current = true; }}
                className="gap-1"
              >
                <XCircle className="h-3.5 w-3.5" /> Abort
              </Button>
              <span className="text-xs text-muted-foreground">{statusMsg}</span>
            </div>
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
      </DialogContent>
    </Dialog>
  );
}
