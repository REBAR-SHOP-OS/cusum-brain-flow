import { useCallback, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload, CheckCircle, AlertTriangle, XCircle, FileArchive,
} from "lucide-react";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";

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

interface QueueItem {
  pending: PendingFile;
  mapping: MappingRow;
  getBlob: () => Promise<Blob>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const BATCH = 3;

async function retryAsync<T>(fn: () => Promise<T>, retries = 5, delayMs = 1500): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error("unreachable");
}

/**
 * Stream-parse dump.sql for the ir_attachment COPY block.
 * Reads chunk-by-chunk so we never load the full 1GB+ file into memory.
 */
async function streamParseMappingFromEntry(
  entry: any,
  onStatus: (msg: string) => void
): Promise<MappingRow[]> {
  const blob: Blob = await entry.getData(new BlobWriter());
  const stream = blob.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");

  let leftover = "";
  let phase: "searching" | "header" | "rows" | "done" = "searching";
  let columns: string[] = [];
  let idIdx = -1, storeFnameIdx = -1, nameIdx = -1, mimetypeIdx = -1, resModelIdx = -1;
  const rows: MappingRow[] = [];
  let bytesRead = 0;

  while (phase !== "done") {
    const { value, done } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    if (bytesRead % (50 * 1024 * 1024) < value.byteLength) {
      onStatus(`Scanning dump.sql… ${Math.round(bytesRead / 1024 / 1024)} MB read, ${rows.length} attachments found`);
    }

    const chunk = leftover + decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");
    leftover = lines.pop() ?? "";

    for (const line of lines) {
      if (phase === "searching") {
        if (line.match(/^COPY public\.ir_attachment\s*\(/i)) {
          // Parse column names from the COPY header
          const colMatch = line.match(/\(([^)]+)\)/);
          if (colMatch) {
            columns = colMatch[1].split(",").map((c) => c.trim().toLowerCase());
            idIdx = columns.indexOf("id");
            storeFnameIdx = columns.indexOf("store_fname");
            nameIdx = columns.indexOf("name");
            mimetypeIdx = columns.indexOf("mimetype");
            resModelIdx = columns.indexOf("res_model");
            if (idIdx >= 0 && storeFnameIdx >= 0 && nameIdx >= 0 && mimetypeIdx >= 0) {
              phase = "rows";
            }
          }
        }
        continue;
      }

      if (phase === "rows") {
        if (line === "\\." || line.startsWith("\\.\r")) {
          phase = "done";
          break;
        }
        const cols = line.split("\t");
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
    }
  }

  reader.cancel();
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
  const failedQueueRef = useRef<QueueItem[]>([]);

  /* ── shared upload helper ── */
  const processQueue = useCallback(
    async (queue: QueueItem[]) => {
      toast.info(`Starting upload of ${queue.length} files…`);
      setTotal(queue.length);
      setUploading(true);
      setUploaded(0);
      setFailed(0);
      setErrors([]);
      abortRef.current = false;
      failedQueueRef.current = [];

      let ok = 0;
      let fail = 0;
      const errs: string[] = [];
      const failedItems: QueueItem[] = [];

      for (let i = 0; i < queue.length; i += BATCH) {
        if (abortRef.current) break;
        const batch = queue.slice(i, i + BATCH);

        await Promise.all(
          batch.map(async (item) => {
            const { pending: p, mapping: m, getBlob } = item;
            try {
              const safeName = m.name.replace(/[^\w.\-]/g, "_");
              const storagePath = `odoo-archive/${p.lead_id}/${p.odoo_id}-${safeName}`;
              await retryAsync(async () => {
                const blob = await getBlob();
                const { error: upErr } = await supabase.storage
                  .from("estimation-files")
                  .upload(storagePath, blob, {
                    contentType: m.mimetype || "application/octet-stream",
                    upsert: true,
                  });
                if (upErr) throw upErr;
              });

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
              failedItems.push(item);
            }
          })
        );
        setUploaded(ok);
        setFailed(fail);
        setErrors([...errs]);

        // breathe between batches
        if (i + BATCH < queue.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      failedQueueRef.current = failedItems;
      setUploading(false);
      setStatusMsg(`Import complete: ${ok} uploaded, ${fail} failed`);
      toast.success(`Import complete: ${ok} uploaded, ${fail} failed`);
    },
    []
  );

  /* ── Single ZIP handler ── */
  const handleZipSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setStatusMsg("Opening ZIP…");
      const reader = new ZipReader(new BlobReader(file));
      const entries = await reader.getEntries();

      // 1. Find dump.sql and stream-parse mapping
      setStatusMsg("Looking for dump.sql…");
      const dumpEntry = entries.find((e) => e.filename.endsWith("dump.sql") && !e.directory);
      if (!dumpEntry) {
        toast.error("No dump.sql found in the ZIP");
        await reader.close();
        return;
      }

      const mapping = await streamParseMappingFromEntry(dumpEntry, setStatusMsg);

      if (mapping.length === 0) {
        toast.error("No ir_attachment rows for crm.lead found in dump.sql");
        await reader.close();
        return;
      }
      toast.success(`Found ${mapping.length} attachment mappings in dump.sql`);

      // 2. Fetch pending files from DB
      setStatusMsg("Fetching pending files from database…");
      const allPending: PendingFile[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("lead_files")
          .select("odoo_id, lead_id, file_name")
          .not("odoo_id", "is", null)
          .is("storage_path", null)
          .range(from, from + PAGE - 1);
        if (error) {
          toast.error("Failed to fetch pending files");
          await reader.close();
          return;
        }
        allPending.push(...(data as unknown as PendingFile[]));
        setStatusMsg(`Fetching pending files… ${allPending.length} so far`);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setStatusMsg(`Found ${allPending.length} pending files in database`);
      const pending = allPending;

      // 3. Build lookup and match
      const mappingById = new Map<number, MappingRow>();
      mapping.forEach((m) => mappingById.set(m.id, m));

      const neededFnames = new Map<string, { pending: PendingFile; mapping: MappingRow }>();
      for (const p of pending) {
        const m = mappingById.get(p.odoo_id);
        if (m) neededFnames.set(m.store_fname, { pending: p, mapping: m });
      }

      setStatusMsg("Matching filestore entries…");
      const queue: QueueItem[] = [];

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
            Select your Odoo dump ZIP — mapping is auto-extracted from dump.sql (streamed, works with large files).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-semibold">
              <FileArchive className="h-4 w-4" /> Select Odoo Dump ZIP
            </Label>
            <p className="text-xs text-muted-foreground">
              ZIP should contain <code className="bg-muted px-1 rounded">dump.sql</code> + <code className="bg-muted px-1 rounded">filestore/</code>.
            </p>
            <Input type="file" accept=".zip" disabled={uploading} onChange={handleZipSelect} />
          </div>

          {statusMsg && (
            <p className="text-xs text-muted-foreground italic">{statusMsg}</p>
          )}

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

          {!uploading && failed > 0 && failedQueueRef.current.length > 0 && (
            <Button
              variant="default"
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => processQueue(failedQueueRef.current)}
            >
              <AlertTriangle className="h-4 w-4" />
              Retry {failedQueueRef.current.length} Failed
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
