import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Brain, Zap, Trash2, Check, Pencil, Loader2 } from "lucide-react";
import { useVizzyMemory, VizzyMemoryEntry } from "@/hooks/useVizzyMemory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  brain_insight: "🧠 Insight",
  general: "📌 General",
  benchmark: "📊 Benchmark",
  call_summary: "📞 Call",
  voicemail_summary: "📩 Voicemail",
  agent_audit: "🤖 Audit",
  auto_fix: "🔧 Auto-Fix",
  feedback_patch: "📝 Feedback",
  pre_digest: "📋 Digest",
};

function getCategoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] || cat;
}

function MemoryCard({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: VizzyMemoryEntry;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);

  const save = () => {
    onUpdate(entry.id, draft);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {getCategoryLabel(entry.category)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(entry.created_at), "MMM d, HH:mm")}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm min-h-[60px]"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              <Check className="w-3 h-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {entry.content}
        </p>
      )}

      {!editing && (
        <div className="flex gap-1 justify-end">
          <button
            onClick={() => { setDraft(entry.content); setEditing(true); }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function VizzyBrainPanel({ onClose }: Props) {
  const { entries, isLoading, categories, updateEntry, deleteEntry, analyzeSystem } = useVizzyMemory();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  const filtered = activeCategory
    ? entries.filter((e) => e.category === activeCategory)
    : entries;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const count = await analyzeSystem();
      toast({ title: `🧠 ${count} insight(s) added` });
      setActiveCategory("brain_insight");
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-2xl max-h-[85vh] mx-4 rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Vizzy Brain</h2>
            <span className="text-xs text-muted-foreground">({entries.length} memories)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="gap-1"
            >
              {analyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {analyzing ? "Analyzing..." : "Analyze Now"}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-border bg-muted/10">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              !activeCategory
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Memory List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No memories yet. Click "Analyze Now" to scan the system.</p>
            </div>
          ) : (
            filtered.map((entry) => (
              <MemoryCard
                key={entry.id}
                entry={entry}
                onUpdate={(id, content) => updateEntry({ id, content })}
                onDelete={deleteEntry}
              />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
