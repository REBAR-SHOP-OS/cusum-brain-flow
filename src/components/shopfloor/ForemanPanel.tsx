import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Brain,
  AlertTriangle,
  AlertOctagon,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import type { ForemanResult } from "@/hooks/useForemanBrain";
import type { PlaybookEntry } from "@/lib/foremanPlaybook";

interface ForemanPanelProps {
  foreman: ForemanResult;
  compact?: boolean;
}

export function ForemanPanel({ foreman, compact = false }: ForemanPanelProps) {
  const { decision, playbook, suggestions } = foreman;
  const [showWhy, setShowWhy] = useState(false);
  const [showPlaybook, setShowPlaybook] = useState(false);

  if (!decision) return null;

  const hasBlockers = decision.blockers.length > 0;
  const hasWarnings = decision.warnings.length > 0;
  const hasAlternatives = decision.alternatives.length > 0;
  const smartSuggestions = [...suggestions.actions, ...suggestions.optimizations].slice(0, 3);

  return (
    <div className="space-y-3">
      {/* ── BLOCKERS ── */}
      {hasBlockers && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-xs font-bold tracking-wider uppercase text-destructive">
                Blockers
              </span>
            </div>
            {decision.blockers.map((b) => (
              <div key={b.code} className="space-y-1">
                <p className="text-sm font-semibold text-destructive">{b.title}</p>
                <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-0.5 pl-1">
                  {b.fixSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── FOREMAN INSTRUCTIONS ── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold tracking-wider uppercase text-primary">
              Foreman Instructions
            </span>
          </div>

          {decision.instructions.length > 0 ? (
            <div className="space-y-1.5">
              {decision.instructions.map((inst) => (
                <div key={inst.step} className="flex items-start gap-2">
                  <Badge className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center shrink-0 p-0 text-[10px]">
                    {inst.step}
                  </Badge>
                  <p className="text-sm text-foreground">
                    {inst.text}
                    {inst.emphasis && (
                      <span className="font-black font-mono text-primary ml-1">
                        {inst.emphasis}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{decision.recommendation}</p>
          )}

          {/* Recommendation summary */}
          {!compact && decision.recommendation && (
            <div className="flex items-start gap-2 pt-1 border-t border-primary/10 mt-2">
              <ArrowRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground font-medium">{decision.recommendation}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── WARNINGS ── */}
      {hasWarnings && (
        <Card className="border-accent bg-accent/50">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent-foreground shrink-0" />
              <span className="text-xs font-bold tracking-wider uppercase text-accent-foreground">
                Warnings
              </span>
            </div>
            {decision.warnings.map((w, i) => (
              <p key={i} className="text-xs text-muted-foreground">{w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── ALTERNATIVES ── */}
      {hasAlternatives && !compact && (
        <Card className="border-border bg-card">
          <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-bold tracking-wider uppercase text-primary">
                Alternatives
              </span>
            </div>
            {decision.alternatives.map((alt, i) => (
              <div key={i} className="p-2 rounded bg-muted/50 space-y-0.5">
                <p className="text-xs font-semibold text-foreground">{alt.label}</p>
                <p className="text-[11px] text-muted-foreground">{alt.description}</p>
                <p className="text-[10px] text-primary italic">{alt.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── SMART SUGGESTIONS (from DB) ── */}
      {smartSuggestions.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-3 space-y-2">
            <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
              Smart Suggestions
            </span>
            {smartSuggestions.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                  {s.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{s.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => foreman.acceptSuggestion(s.id)}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => foreman.dismissSuggestion(s.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── WHY? dropdown ── */}
      {!compact && decision.recommendationReason && (
        <Collapsible open={showWhy} onOpenChange={setShowWhy}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground w-full justify-start">
              <HelpCircle className="w-3.5 h-3.5" />
              Why this recommendation?
              {showWhy ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-2 text-xs text-muted-foreground bg-muted/30 rounded-b-lg">
              {decision.recommendationReason}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ── PLAYBOOK entry ── */}
      {playbook && !compact && (
        <Collapsible open={showPlaybook} onOpenChange={setShowPlaybook}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground w-full justify-start">
              <AlertTriangle className="w-3.5 h-3.5" />
              Edge Case: {playbook.title}
              {showPlaybook ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <PlaybookCard entry={playbook} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function PlaybookCard({ entry }: { entry: PlaybookEntry }) {
  const severityColor = {
    info: "text-primary bg-primary/10 border-primary/30",
    warn: "text-accent-foreground bg-accent/50 border-accent",
    critical: "text-destructive bg-destructive/10 border-destructive/30",
  }[entry.severity];

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${severityColor}`}>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {entry.module}
        </Badge>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {entry.severity}
        </Badge>
      </div>
      <p className="text-xs font-medium">{entry.detection}</p>
      <ol className="list-decimal list-inside text-[11px] space-y-0.5 opacity-80">
        {entry.resolution.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>
    </div>
  );
}
