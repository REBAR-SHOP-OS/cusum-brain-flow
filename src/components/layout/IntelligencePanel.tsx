import { useState } from "react";
import { X, Sparkles, AlertTriangle, Lightbulb, BookOpen, Send, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSuggestions } from "@/hooks/useSuggestions";
import { useCommandHandler } from "@/hooks/useCommandHandler";
import { cn } from "@/lib/utils";

export function IntelligencePanel() {
  const { intelligencePanelOpen, setIntelligencePanelOpen } = useWorkspace();
  const { actions, warnings, learnings, optimizations, acceptSuggestion, dismissSuggestion } = useSuggestions();
  const { executeCommand, isProcessing, lastResult } = useCommandHandler();
  const [question, setQuestion] = useState("");

  if (!intelligencePanelOpen) return null;

  const handleAsk = async () => {
    if (!question.trim() || isProcessing) return;
    const q = question;
    setQuestion("");
    await executeCommand(q);
  };

  return (
    <aside className="w-72 shrink-0 border-l border-border bg-card flex flex-col h-full animate-slide-in">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold tracking-wider uppercase">Intelligence</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIntelligencePanelOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Warnings */}
          {warnings.length > 0 && (
            <SuggestionSection
              title="Warnings"
              icon={AlertTriangle}
              iconColor="text-warning"
              items={warnings}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />
          )}

          {/* Next Best Actions */}
          {actions.length > 0 && (
            <SuggestionSection
              title="Suggested Actions"
              icon={CheckCircle2}
              iconColor="text-primary"
              items={actions}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />
          )}

          {/* Optimizations */}
          {optimizations.length > 0 && (
            <SuggestionSection
              title="Optimizations"
              icon={Lightbulb}
              iconColor="text-warning"
              items={optimizations}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />
          )}

          {/* Recent Learnings */}
          {learnings.length > 0 && (
            <SuggestionSection
              title="Recent Learnings"
              icon={BookOpen}
              iconColor="text-muted-foreground"
              items={learnings}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />
          )}

          {/* Empty state */}
          {warnings.length === 0 && actions.length === 0 && optimizations.length === 0 && learnings.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No active suggestions right now.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">The system will surface insights as conditions change.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Last result */}
      {lastResult && lastResult.intent !== "navigate" && (
        <div className="border-t border-border p-3 shrink-0">
          <div className="rounded-md bg-muted p-2">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">System Response</p>
            <p className="text-xs whitespace-pre-wrap">{lastResult.message}</p>
          </div>
        </div>
      )}

      {/* Ask the System */}
      <div className="border-t border-border p-3 shrink-0">
        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">Ask the System</p>
        <div className="flex gap-1.5">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Show idle machines"
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            disabled={isProcessing}
          />
          <Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleAsk} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}

function SuggestionSection({
  title,
  icon: Icon,
  iconColor,
  items,
  onAccept,
  onDismiss,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: { id: string; title: string; description: string | null; priority: number; suggestion_type: string }[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
          {title}
        </span>
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto">
          {items.length}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="group rounded-md border border-border bg-background p-2 hover:border-primary/30 transition-colors"
          >
            <p className="text-xs font-medium leading-snug">{item.title}</p>
            {item.description && (
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
            )}
            <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5 text-primary"
                onClick={() => onAccept(item.id)}
              >
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5 text-muted-foreground"
                onClick={() => onDismiss(item.id)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
