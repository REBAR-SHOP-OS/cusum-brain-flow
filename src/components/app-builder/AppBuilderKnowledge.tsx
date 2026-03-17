import { useEffect, useState } from "react";
import { Brain, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Memory {
  id: string;
  category: string;
  key: string;
  value: string;
  created_at: string;
}

export function AppBuilderKnowledge() {
  const { companyId } = useCompanyId();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    (supabase as any)
      .from("agent_memory")
      .select("id, category, key, value, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMemories((data as Memory[]) ?? []);
        setLoading(false);
      });
  }, [companyId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("agent_memory").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete memory", variant: "destructive" });
    } else {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "Deleted", description: "Memory entry removed" });
    }
  };

  const grouped = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-5 h-5 text-orange-400" />
        <h3 className="text-lg font-semibold text-foreground">Knowledge</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Project memories and learned context used by the Architect agent.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No memories stored yet. The agent will learn as you interact.
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="rounded-2xl border border-border bg-card p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {cat}
            </h4>
            <div className="space-y-2">
              {items.map((m) => (
                <div key={m.id} className="flex items-start gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.key}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{m.value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 shrink-0 h-7 w-7"
                    onClick={() => handleDelete(m.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
