import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail, Clock, FileText, TrendingUp, ArrowRight, MessageSquare,
  Send, Sparkles, CheckSquare, BarChart3, CalendarPlus, Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreateTaskDialog, type CreateTaskDefaults } from "@/components/shared/CreateTaskDialog";
import ReactMarkdown from "react-markdown";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface LeadAIPanelProps {
  lead: LeadWithCustomer;
}

type ActionType = "draft_followup" | "draft_email" | "score_lead" | "set_reminder" | "recommend_stage" | "generate_quote" | "analyze";

interface QuickAction {
  action: ActionType;
  label: string;
  icon: React.ElementType;
  description: string;
}

const quickActions: QuickAction[] = [
  { action: "draft_followup", label: "Follow-Up", icon: Mail, description: "Draft a follow-up email" },
  { action: "set_reminder", label: "Reminder", icon: CalendarPlus, description: "Suggest best reminder timing" },
  { action: "generate_quote", label: "Quote", icon: FileText, description: "Generate quotation line items" },
  { action: "score_lead", label: "Score", icon: BarChart3, description: "Score this lead 0-100" },
  { action: "recommend_stage", label: "Stage", icon: ArrowRight, description: "Recommend pipeline stage" },
  { action: "draft_email", label: "Email", icon: MessageSquare, description: "Draft a custom email" },
];

export function LeadAIPanel({ lead }: LeadAIPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ action: string; data: any } | null>(null);
  const [freeText, setFreeText] = useState("");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<CreateTaskDefaults>({ title: "", description: "", source: "ai", sourceRef: "" });
  const { toast } = useToast();

  const runAction = async (action: ActionType, userMessage?: string) => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: {
          lead: {
            ...lead,
            customer_name: lead.customers?.company_name || lead.customers?.name || null,
          },
          action,
          userMessage,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        toast({ title: "AI Error", description: data.error, variant: "destructive" });
        return;
      }

      setResult({ action, data });
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Could not reach AI",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFreeText = () => {
    if (!freeText.trim()) return;
    runAction("analyze", freeText.trim());
    setFreeText("");
  };

  const openTaskDialog = (title: string, description: string, dueDate?: string) => {
    setTaskDefaults({
      title,
      description,
      source: "pipeline-ai",
      sourceRef: lead.id,
    });
    setTaskDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-3 gap-2">
        {quickActions.map((qa) => (
          <Button
            key={qa.action}
            variant="outline"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-3 text-xs"
            onClick={() => runAction(qa.action)}
            disabled={loading}
          >
            <qa.icon className="w-4 h-4 text-primary" />
            {qa.label}
          </Button>
        ))}
      </div>

      <Separator />

      {/* AI Response Area */}
      <div className="min-h-[200px]">
        {loading && (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 animate-pulse text-primary" />
              Blitz is thinking...
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {!loading && !result && (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mb-3 text-primary/40" />
            <p className="text-sm font-medium">Ask Blitz anything about this lead</p>
            <p className="text-xs mt-1">Use the quick actions above or type below</p>
          </div>
        )}

        {!loading && result && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            {/* Score Lead */}
            {result.action === "score_lead" && (
              <>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-primary">{result.data.score}</div>
                  <div className="text-sm text-muted-foreground">/100</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.data.factors?.map((f: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
                </div>
                <p className="text-sm">{result.data.recommendation}</p>
              </>
            )}

            {/* Draft Follow-up / Email */}
            {(result.action === "draft_followup" || result.action === "draft_email") && (
              <>
                {result.data.subject && (
                  <div>
                    <span className="text-xs text-muted-foreground">Subject:</span>
                    <p className="text-sm font-medium">{result.data.subject}</p>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{result.data.body || result.data.draft}</div>
                {result.data.tone && (
                  <Badge variant="outline" className="text-xs">Tone: {result.data.tone}</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openTaskDialog(
                    `Follow up: ${lead.title}`,
                    result.data.body || result.data.draft || ""
                  )}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Create Task
                </Button>
              </>
            )}

            {/* Set Reminder */}
            {result.action === "set_reminder" && (
              <>
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{result.data.suggested_date}</span>
                  <Badge variant="outline" className="text-xs">{result.data.priority}</Badge>
                </div>
                <p className="text-sm">{result.data.message}</p>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openTaskDialog(
                    result.data.message,
                    `Reminder for lead: ${lead.title}`,
                    result.data.suggested_date
                  )}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Create Reminder Task
                </Button>
              </>
            )}

            {/* Recommend Stage */}
            {result.action === "recommend_stage" && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{result.data.current}</Badge>
                  <ArrowRight className="w-4 h-4" />
                  <Badge className="bg-primary text-primary-foreground">{result.data.recommended}</Badge>
                  <span className="text-muted-foreground text-xs">({result.data.confidence}% confident)</span>
                </div>
                <p className="text-sm">{result.data.reason}</p>
              </>
            )}

            {/* Generate Quote */}
            {result.action === "generate_quote" && (
              <>
                <h4 className="text-sm font-semibold">Draft Quotation</h4>
                <div className="rounded border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Description</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Unit</th>
                        <th className="text-right p-2">Price</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.items?.map((item: any, i: number) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2">{item.description}</td>
                          <td className="text-right p-2">{item.quantity}</td>
                          <td className="text-right p-2">{item.unit}</td>
                          <td className="text-right p-2">${item.unit_price?.toFixed(2)}</td>
                          <td className="text-right p-2 font-medium">${item.total?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr className="border-t border-border">
                        <td colSpan={4} className="p-2 text-right font-medium">Total</td>
                        <td className="p-2 text-right font-bold">
                          ${result.data.items?.reduce((s: number, i: any) => s + (i.total || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {result.data.notes && <p className="text-xs text-muted-foreground">{result.data.notes}</p>}
                <p className="text-xs text-muted-foreground">Valid for {result.data.validity_days} days</p>
              </>
            )}

            {/* Analyze (free-form) */}
            {result.action === "analyze" && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result.data.answer}</ReactMarkdown>
              </div>
            )}

            {/* Suggest Actions */}
            {result.action === "suggest_actions" && (
              <>
                <p className="text-sm font-medium">{result.data.summary}</p>
                <Badge variant="outline">{result.data.urgency}</Badge>
                <div className="space-y-2">
                  {result.data.suggestions?.map((s: any, i: number) => (
                    <div key={i} className="rounded border border-border p-2 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{s.action_type}</Badge>
                        <span className="font-medium">{s.title}</span>
                      </div>
                      <p className="text-muted-foreground">{s.description}</p>
                      <div className="flex gap-2 text-muted-foreground">
                        <span>Priority: {s.priority}</span>
                        <span>•</span>
                        <span>{s.timing}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Free-text input */}
      <div className="flex gap-2">
        <Input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Ask Blitz anything about this lead..."
          onKeyDown={(e) => e.key === "Enter" && handleFreeText()}
          disabled={loading}
          className="text-sm"
        />
        <Button size="icon" onClick={handleFreeText} disabled={loading || !freeText.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Task Dialog */}
      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        defaults={taskDefaults}
      />
    </div>
  );
}
