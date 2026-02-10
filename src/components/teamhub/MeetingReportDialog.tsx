import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, CheckCircle2, AlertTriangle, ListTodo,
  Clock, Users, Copy, Check, Loader2, ThumbsUp, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MeetingReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
}

export function MeetingReportDialog({ open, onOpenChange, meetingId }: MeetingReportDialogProps) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Fetch meeting with report
  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting-report", meetingId],
    enabled: open && !!meetingId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_meetings")
        .select("*")
        .eq("id", meetingId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch action items
  const { data: actionItems } = useQuery({
    queryKey: ["meeting-action-items", meetingId],
    enabled: open && !!meetingId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meeting_action_items")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Update action item status
  const updateAction = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("meeting_action_items")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-action-items", meetingId] });
    },
  });

  const report = meeting?.structured_report;
  const durationMin = meeting?.duration_seconds ? Math.round(meeting.duration_seconds / 60) : 0;

  const handleCopy = async () => {
    if (!meeting?.notes) return;
    await navigator.clipboard.writeText(meeting.notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Report copied to clipboard");
  };

  const handleApproveAll = async () => {
    const drafts = (actionItems || []).filter((a: any) => a.status === "draft");
    for (const item of drafts) {
      await updateAction.mutateAsync({ id: item.id, status: "approved" });
    }
    toast.success(`${drafts.length} action items approved`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Meeting Report
            {meeting?.title && (
              <span className="text-muted-foreground font-normal text-sm">— {meeting.title}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !report ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">AI summary is still being generated...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">This usually takes 15-30 seconds after the meeting ends.</p>
          </div>
        ) : (
          <Tabs defaultValue="summary" className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">
                Actions
                {actionItems?.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[9px] px-1">{actionItems.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-2">
              <TabsContent value="summary" className="mt-0 space-y-4 p-1">
                {/* Meta */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clock className="w-3 h-3" /> {durationMin} min
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Users className="w-3 h-3" /> {meeting?.participants?.length || 0} participants
                  </Badge>
                  {meeting?.recording_url && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-red-400 border-red-400/30">
                      🔴 Recorded
                    </Badge>
                  )}
                </div>

                {/* Executive Summary */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Executive Summary</h3>
                  <p className="text-sm text-foreground leading-relaxed">{report.executiveSummary}</p>
                </div>

                {/* Key Bullets */}
                {report.keyBullets?.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Points</h3>
                    {report.keyBullets.map((b: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary mt-1">•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Decisions */}
                {report.decisions?.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Decisions
                    </h3>
                    {report.decisions.map((d: any, i: number) => (
                      <div key={i} className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{d.decision || d}</p>
                        {d.context && <p className="text-xs text-muted-foreground mt-0.5">{d.context}</p>}
                        {d.owner && <p className="text-[10px] text-green-400 mt-0.5">Owner: {d.owner}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Risks */}
                {report.risks?.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Risks
                    </h3>
                    {report.risks.map((r: string, i: number) => (
                      <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        <p className="text-sm text-foreground">{r}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="mt-0 space-y-3 p-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Action Items ({actionItems?.length || 0})
                  </h3>
                  {(actionItems || []).some((a: any) => a.status === "draft") && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleApproveAll}>
                      <ThumbsUp className="w-3 h-3" /> Approve All Drafts
                    </Button>
                  )}
                </div>

                {(actionItems || []).map((item: any) => (
                  <div key={item.id} className={cn(
                    "rounded-lg border px-3 py-2.5 space-y-1",
                    item.status === "draft" ? "border-blue-500/20 bg-blue-500/5" :
                    item.status === "approved" ? "border-green-500/20 bg-green-500/5" :
                    item.status === "dismissed" ? "border-muted/30 bg-muted/5 opacity-50" :
                    "border-border"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <Badge variant="outline" className={cn("text-[9px] shrink-0",
                        item.status === "draft" ? "text-blue-400 border-blue-400/30" :
                        item.status === "approved" ? "text-green-400 border-green-400/30" :
                        "text-muted-foreground"
                      )}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {item.assignee_name && <span>→ {item.assignee_name}</span>}
                      {item.due_date && <span>Due: {item.due_date}</span>}
                      <Badge variant="secondary" className="text-[9px] px-1">{item.priority}</Badge>
                      {item.confidence != null && (
                        <span className="text-muted-foreground/60">{Math.round(item.confidence * 100)}% confidence</span>
                      )}
                    </div>
                    {item.status === "draft" && (
                      <div className="flex gap-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2 gap-1 text-green-400 border-green-400/30"
                          onClick={() => updateAction.mutate({ id: item.id, status: "approved" })}
                        >
                          <ThumbsUp className="w-2.5 h-2.5" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2 gap-1 text-muted-foreground"
                          onClick={() => updateAction.mutate({ id: item.id, status: "dismissed" })}
                        >
                          <X className="w-2.5 h-2.5" /> Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {(!actionItems || actionItems.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-6">No action items extracted from this meeting.</p>
                )}
              </TabsContent>

              <TabsContent value="details" className="mt-0 space-y-4 p-1">
                {/* Participant Contributions */}
                {report.participantContributions?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Participant Contributions</h3>
                    {report.participantContributions.map((p: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border/50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{p.name}</span>
                          {p.role && <span className="text-[10px] text-muted-foreground">{p.role}</span>}
                        </div>
                        {p.keyPoints?.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {p.keyPoints.map((kp: string, j: number) => (
                              <li key={j} className="text-xs text-muted-foreground">• {kp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Follow-ups */}
                {report.followUps?.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow-ups</h3>
                    {report.followUps.map((f: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-muted-foreground mt-1">→</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Report"}
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
