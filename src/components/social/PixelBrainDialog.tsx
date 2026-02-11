import { useState, useEffect } from "react";
import { X, Plus, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { AddKnowledgeDialog } from "@/components/brain/AddKnowledgeDialog";
import { KnowledgeDetailDialog } from "@/components/brain/KnowledgeDetailDialog";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string | null;
  category: string;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface PixelBrainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons: Record<string, string> = {
  memory: "🧠",
  image: "🖼️",
  video: "🎬",
  webpage: "🌐",
  document: "📄",
};

export function PixelBrainDialog({ open, onOpenChange }: PixelBrainDialogProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const { companyId } = useCompanyId();

  const fetchItems = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("knowledge")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      const filtered = (data || []).filter(
        (item: any) => item.metadata && (item.metadata as any).agent === "social"
      ) as KnowledgeItem[];
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchItems();
  }, [open, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
        <div
          className="w-full sm:max-w-md max-h-[80vh] bg-card rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Pixel Brain</h2>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No knowledge added yet.</p>
                <p className="text-xs mt-1">Add resources and instructions for Pixel to use when creating content.</p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                >
                  <span className="text-lg mt-0.5">{categoryIcons[item.category] || "📝"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.content}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button className="w-full gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Knowledge
            </Button>
          </div>
        </div>
      </div>

      <AddKnowledgeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={fetchItems}
        defaultMetadata={{ agent: "social" }}
      />

      <KnowledgeDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdated={fetchItems}
      />
    </>
  );
}
