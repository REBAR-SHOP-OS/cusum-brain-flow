import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bug, Copy, Check, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface FixRequest {
  id: string;
  description: string;
  photo_url: string | null;
  affected_area: string | null;
  status: string;
  created_at: string;
}

export function FixRequestQueue() {
  const [requests, setRequests] = useState<FixRequest[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("vizzy_fix_requests" as any)
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setRequests(data as any);
  };

  const copyToClipboard = (req: FixRequest) => {
    const text = `🐛 Fix Request from Vizzy:\n- Issue: ${req.description}\n- Area: ${req.affected_area || "Not specified"}\n- Logged: ${new Date(req.created_at).toLocaleString()}${req.photo_url ? `\n- Photo: ${req.photo_url}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedId(req.id);
    toast.success("Copied to clipboard — paste in Lovable chat");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resolveRequest = async (id: string) => {
    await supabase
      .from("vizzy_fix_requests" as any)
      .update({ status: "resolved", resolved_at: new Date().toISOString() } as any)
      .eq("id", id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success("Marked as resolved");
  };

  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bug className="w-5 h-5 text-destructive" />
        <h3 className="font-semibold text-sm">Vizzy Fix Requests</h3>
        <span className="ml-auto text-xs text-muted-foreground">{requests.length} open</span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {requests.map((req) => (
          <div key={req.id} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{req.description}</p>
              {req.affected_area && (
                <p className="text-xs text-muted-foreground mt-0.5">Area: {req.affected_area}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(req.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {req.photo_url && (
                <a href={req.photo_url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button onClick={() => copyToClipboard(req)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                {copiedId === req.id ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => resolveRequest(req.id)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
