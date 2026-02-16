import { useState } from "react";
import { Check, X, FileCode, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PatchReviewProps {
  patchId: string;
  filePath: string;
  targetSystem: string;
  description: string;
  content: string;
}

export function PatchReview({ patchId, filePath, targetSystem, description, content }: PatchReviewProps) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(false);

  const handleAction = async (newStatus: "approved" | "rejected") => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("code_patches" as any)
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", patchId);

      if (error) throw error;
      setStatus(newStatus);
      toast.success(`Patch ${newStatus}`);
    } catch (err) {
      toast.error(`Failed to ${newStatus} patch`);
    } finally {
      setLoading(false);
    }
  };

  const systemColors: Record<string, string> = {
    odoo: "text-purple-400",
    erp: "text-blue-400",
    wordpress: "text-green-400",
    other: "text-muted-foreground",
  };

  return (
    <div className="my-3 rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border/40">
        <FileCode className={cn("w-4 h-4", systemColors[targetSystem] || "text-muted-foreground")} />
        <span className="text-xs font-mono text-muted-foreground truncate flex-1">{filePath}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/40 uppercase tracking-wider font-medium text-muted-foreground">
          {targetSystem}
        </span>
      </div>

      {/* Description */}
      {description && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/30">
          {description}
        </div>
      )}

      {/* Diff content */}
      <pre className="px-4 py-3 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
        {content.split("\n").map((line, i) => {
          let lineClass = "text-muted-foreground";
          if (line.startsWith("+") && !line.startsWith("+++")) lineClass = "text-green-500";
          else if (line.startsWith("-") && !line.startsWith("---")) lineClass = "text-red-400";
          else if (line.startsWith("@@")) lineClass = "text-blue-400";
          return (
            <div key={i} className={cn(lineClass, "min-h-[1.25rem]")}>
              {line || " "}
            </div>
          );
        })}
      </pre>

      {/* Actions */}
      {status === "pending" ? (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border/40 bg-muted/30">
          <button
            onClick={() => handleAction("approved")}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600/20 text-green-500 hover:bg-green-600/30 border border-green-600/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Approve
          </button>
          <button
            onClick={() => handleAction("rejected")}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Reject
          </button>
        </div>
      ) : (
        <div className={cn(
          "px-4 py-2.5 text-xs font-medium border-t border-border/40",
          status === "approved" ? "text-green-500 bg-green-600/10" : "text-red-400 bg-red-600/10"
        )}>
          {status === "approved" ? "✅ Patch approved" : "❌ Patch rejected"}
        </div>
      )}
    </div>
  );
}
