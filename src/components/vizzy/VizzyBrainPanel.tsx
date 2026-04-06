import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Brain, Zap, Trash2, Check, Pencil, Loader2, AlertTriangle } from "lucide-react";
import { useVizzyMemory, VizzyMemoryEntry } from "@/hooks/useVizzyMemory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  onClose: () => void;
}

const SIDEBAR_GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: "dashboard",    label: "📊 Dashboard",       categories: ["brain_insight", "general", "benchmark", "daily_benchmark"] },
  { key: "inbox",        label: "📥 Inbox",            categories: ["email"] },
  { key: "team_hub",     label: "💬 Team Hub",         categories: ["feedback_clarification", "feedback_patch"] },
  { key: "tasks",        label: "📋 Business Tasks",   categories: ["auto_fix", "feedback_fix"] },
  { key: "monitor",      label: "📡 Live Monitor",     categories: ["agent_audit", "pre_digest"] },
  { key: "ceo",          label: "🏢 CEO Portal",       categories: ["business"] },
  { key: "support",      label: "🎧 Support",          categories: ["feedback_escalation", "call_summary", "voicemail_summary"] },
  { key: "pipeline",     label: "📈 Pipeline",         categories: ["leads"] },
  { key: "lead_scoring", label: "🎯 Lead Scoring",     categories: ["lead_scoring"] },
  { key: "customers",    label: "👥 Customers",        categories: ["crm"] },
  { key: "accounting",   label: "💰 Accounting",       categories: ["accounting"] },
  { key: "sales",        label: "🛒 Sales",            categories: ["sales", "orders"] },
  { key: "production",   label: "🏭 Production",       categories: ["production"] },
  { key: "shop_floor",   label: "🔧 Shop Floor",       categories: ["shop_floor"] },
  { key: "timeclock",    label: "⏰ Time Clock",       categories: ["timeclock"] },
  { key: "office_tools", label: "🛠️ Office Tools",     categories: ["office_tools"] },
];

// Build a reverse map: category -> group key
const CATEGORY_TO_GROUP: Record<string, string> = {};
for (const g of SIDEBAR_GROUPS) {
  for (const c of g.categories) {
    CATEGORY_TO_GROUP[c] = g.key;
  }
}

function getDateKey(dateStr: string) {
  return format(new Date(dateStr), "yyyy-MM-dd");
}

function getDateLabel(dateStr: string) {
  return format(new Date(dateStr), "MMM d, yyyy");
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
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(entry.created_at), "MMM d, yyyy • HH:mm")}
        </span>
        {!editing && (
          <div className="flex gap-1">
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
    </div>
  );
}

function DateGroupedEntries({
  items,
  onUpdate,
  onDelete,
}: {
  items: VizzyMemoryEntry[];
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, VizzyMemoryEntry[]> = {};
    for (const e of items) {
      const key = getDateKey(e.created_at);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  if (grouped.length <= 1) {
    return (
      <div className="space-y-2 pt-1">
        {items.map((entry) => (
          <MemoryCard
            key={entry.id}
            entry={entry}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      {grouped.map(([dateKey, entries]) => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
              {getDateLabel(entries[0].created_at)}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {entries.map((entry) => (
              <MemoryCard
                key={entry.id}
                entry={entry}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function VizzyBrainPanel({ onClose }: Props) {
  const { entries, isLoading, error, isCompanyLoading, hasCompanyContext, updateEntry, deleteEntry, analyzeSystem } = useVizzyMemory();
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  const grouped = useMemo(() => {
    const map: Record<string, VizzyMemoryEntry[]> = {};
    for (const e of entries) {
      const groupKey = CATEGORY_TO_GROUP[e.category] || "dashboard";
      if (!map[groupKey]) map[groupKey] = [];
      map[groupKey].push(e);
    }
    // Return ALL groups in sidebar order, even if empty
    return SIDEBAR_GROUPS.map((g) => ({ key: g.key, label: g.label, items: map[g.key] || [] }));
  }, [entries]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const count = await analyzeSystem();
      toast({ title: `🧠 ${count} insight(s) added` });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const renderContent = () => {
    if (isLoading || isCompanyLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      );
    }

    if (!hasCompanyContext) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50 text-warning" />
          <p className="text-sm font-medium">Company profile not found</p>
          <p className="text-xs mt-1">Your account may not be linked to a company yet.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50 text-destructive" />
          <p className="text-sm font-medium">Failed to load memories</p>
          <p className="text-xs mt-1">{(error as Error).message}</p>
        </div>
      );
    }

    return (
      <Accordion type="multiple" className="w-full space-y-1">
        {grouped.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border border-border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                {group.label}
                <span className="text-xs text-muted-foreground font-normal">({group.items.length})</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {group.items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center italic">No insights yet</p>
              ) : (
                <DateGroupedEntries
                  items={group.items}
                  onUpdate={(id, content) => updateEntry({ id, content })}
                  onDelete={deleteEntry}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }}
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Vizzy Brain</h2>
            <span className="text-xs text-muted-foreground">({entries.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAnalyze} disabled={analyzing || !hasCompanyContext} className="gap-1">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {renderContent()}
        </div>
      </motion.div>
    </motion.div>
  );
}
