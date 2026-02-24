import { useState, useEffect, useRef } from "react";
import { X, Plus, Brain, Loader2, Paperclip, Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { AddKnowledgeDialog } from "@/components/brain/AddKnowledgeDialog";
import { KnowledgeDetailDialog } from "@/components/brain/KnowledgeDetailDialog";
import { toast } from "sonner";

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
  const [instructions, setInstructions] = useState("");
  const [instructionsSaving, setInstructionsSaving] = useState(false);
  const [instructionsLoaded, setInstructionsLoaded] = useState(false);
  const instructionsIdRef = useRef<string | null>(null);
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

      const all = (data || []) as KnowledgeItem[];
      // Separate instructions item from regular items
      const instrItem = all.find(
        (item) => (item.metadata as any)?.agent === "social" && (item.metadata as any)?.type === "instructions"
      );
      if (instrItem) {
        instructionsIdRef.current = instrItem.id;
        if (!instructionsLoaded) {
          setInstructions(instrItem.content || "");
          setInstructionsLoaded(true);
        }
      } else {
        instructionsIdRef.current = null;
        if (!instructionsLoaded) {
          setInstructions("");
          setInstructionsLoaded(true);
        }
      }

      const filtered = all.filter(
        (item) =>
          (item.metadata as any)?.agent === "social" &&
          (item.metadata as any)?.type !== "instructions"
      );
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setInstructionsLoaded(false);
      fetchItems();
    }
  }, [open, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveInstructions = async () => {
    if (!companyId) return;
    setInstructionsSaving(true);
    try {
      if (instructionsIdRef.current) {
        // Update existing
        const { error } = await supabase
          .from("knowledge")
          .update({ content: instructions.trim(), updated_at: new Date().toISOString() })
          .eq("id", instructionsIdRef.current);
        if (error) throw error;
      } else if (instructions.trim()) {
        // Create new
        const { data, error } = await supabase
          .from("knowledge")
          .insert({
            title: "Pixel Custom Instructions",
            content: instructions.trim(),
            category: "memory",
            company_id: companyId,
            metadata: { agent: "social", type: "instructions" },
          })
          .select("id")
          .single();
        if (error) throw error;
        instructionsIdRef.current = data.id;
      }
      toast.success("Instructions saved!");
    } catch (err) {
      toast.error("Failed to save instructions");
    } finally {
      setInstructionsSaving(false);
    }
  };

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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Instructions Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Custom Instructions</span>
              </div>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Write instructions for Pixel (tone, language, rules, brand guidelines)... These will be used in ALL chats."
                className="min-h-[100px] max-h-[160px] text-sm resize-none"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={saveInstructions}
                disabled={instructionsSaving}
              >
                {instructionsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Instructions
              </Button>
            </div>

            <div className="h-px bg-border" />

            {/* Knowledge Items */}
            <div className="space-y-2">
              <span className="text-sm font-semibold">Files & Resources</span>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No files added yet. Upload images, documents, or links for Pixel to reference.</p>
                </div>
              ) : (
                items.map((item) => {
                  const meta = item.metadata as Record<string, unknown> | null;
                  const fileName = meta?.file_name as string | undefined;
                  const fileType = (meta?.file_type as string | undefined)?.toUpperCase();
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                    >
                      <span className="text-lg mt-0.5">{categoryIcons[item.category] || "📝"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        {fileName && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{fileName}</span>
                            {fileType && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                                {fileType}
                              </span>
                            )}
                          </div>
                        )}
                        {!fileName && item.content && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.content}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button className="w-full gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Add File / Resource
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
