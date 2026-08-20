import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Paperclip, Search, ExternalLink, FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface QBAttachable {
  Id: string;
  FileName?: string;
  FileAccessUri?: string;
  TempDownloadUri?: string;
  Size?: number;
  ContentType?: string;
  Note?: string;
  AttachableRef?: { EntityRef?: { type?: string; value?: string } }[];
}

export function AccountingAttachments({ data }: Props) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<QBAttachable[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "query", query: "SELECT * FROM Attachable MAXRESULTS 200" },
      });
      if (error) throw error;
      setAttachments(res?.QueryResponse?.Attachable || []);
    } catch (e: any) {
      toast({ title: "Failed to load attachments", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = attachments.filter(a => {
    const q = search.toLowerCase();
    return (a.FileName || "").toLowerCase().includes(q) ||
      (a.Note || "").toLowerCase().includes(q);
  });

  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Paperclip className="w-5 h-5" /> Attachments</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search attachments..." className="pl-9" />
      </div>

      {loading && attachments.length === 0 ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No attachments found.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map(a => {
            const linkedType = a.AttachableRef?.[0]?.EntityRef?.type || "—";
            return (
              <Card key={a.Id}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.FileName || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(a.Size)} · {a.ContentType || "unknown"} · Linked to: {linkedType}
                      </p>
                      {a.Note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.Note}</p>}
                    </div>
                  </div>
                  {(a.TempDownloadUri || a.FileAccessUri) && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={a.TempDownloadUri || a.FileAccessUri} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
