import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Reply, ReplyAll, Forward, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InboxEmailThread } from "./InboxEmailThread";
import { InboxCustomerContext } from "./InboxCustomerContext";
import { EmailReplyComposer } from "./EmailReplyComposer";
import { AddToTaskButton } from "@/components/shared/AddToTaskButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { InboxEmail } from "./InboxEmailList";
import type { Communication } from "@/hooks/useCommunications";
import type { ReplyMode } from "./EmailActionBar";

interface InboxDetailViewProps {
  email: InboxEmail;
  onClose: () => void;
}

function extractEmail(fromAddress: string): string {
  const match = fromAddress.match(/<([^>]+)>/);
  if (match) return match[1];
  return fromAddress;
}

export function InboxDetailView({ email, onClose }: InboxDetailViewProps) {
  const [replyMode, setReplyMode] = useState<ReplyMode>(null);
  const [threadComms, setThreadComms] = useState<Communication[]>([]);
  const [loadingThread, setLoadingThread] = useState(true);
  const [rightTab, setRightTab] = useState<"context" | "thread">("context");
  const { toast } = useToast();

  // Load thread — all communications from this sender email
  const loadThread = useCallback(async () => {
    setLoadingThread(true);
    try {
      const senderEmail = email.senderEmail;
      const { data, error } = await supabase
        .from("communications")
        .select("*")
        .or(`from_address.ilike.%${senderEmail}%,to_address.ilike.%${senderEmail}%`)
        .order("received_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped: Communication[] = (data ?? []).map((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        let type: Communication["type"] = "email";
        if (row.source === "ringcentral") {
          type = (meta?.type as string) === "sms" ? "sms" : "call";
        }
        return {
          id: row.id,
          source: row.source as Communication["source"],
          sourceId: row.source_id,
          type,
          direction: (row.direction as Communication["direction"]) ?? "inbound",
          from: row.from_address ?? "",
          to: row.to_address ?? "",
          subject: row.subject,
          preview: row.body_preview,
          status: row.status,
          receivedAt: row.received_at ?? row.created_at,
          threadId: row.thread_id,
          metadata: meta,
        };
      });

      setThreadComms(mapped);
    } catch (err) {
      console.error("Thread load error:", err);
    } finally {
      setLoadingThread(false);
    }
  }, [email.senderEmail]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const handleSmartReply = async () => {
    setReplyMode("reply");
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          emailSubject: email.subject,
          emailBody: email.body || email.preview,
          senderName: email.sender,
          senderEmail: email.senderEmail,
        },
      });
      if (error) throw error;
      if (data?.draft) {
        toast({ title: "Smart Reply ready", description: "AI draft generated — review before sending." });
      }
    } catch (err) {
      toast({
        title: "Failed to generate smart reply",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{email.subject}</h2>
          <p className="text-[11px] text-muted-foreground truncate">
            {email.sender} &lt;{email.senderEmail}&gt;
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setReplyMode("reply")}>
            <Reply className="w-3.5 h-3.5" /> Reply
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setReplyMode("reply-all")}>
            <ReplyAll className="w-3.5 h-3.5" /> Reply All
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setReplyMode("forward")}>
            <Forward className="w-3.5 h-3.5" /> Forward
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleSmartReply}>
            <Sparkles className="w-3.5 h-3.5" /> Smart Reply
          </Button>
        </div>
      </div>

      {/* Split content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Thread timeline */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ScrollArea className="flex-1">
            {loadingThread ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-pulse text-sm text-muted-foreground">Loading thread...</div>
              </div>
            ) : (
              <InboxEmailThread
                communications={threadComms}
                currentEmailId={email.id}
              />
            )}
          </ScrollArea>

          {/* Bottom action bar */}
          {!replyMode && (
            <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center gap-2">
              <AddToTaskButton
                defaults={{
                  title: `Follow up: ${email.subject}`,
                  description: email.preview || "",
                  source: "email",
                  sourceRef: email.sourceId || email.id,
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setReplyMode("reply")}
              >
                <Reply className="w-3.5 h-3.5" /> Quick Reply
              </Button>
            </div>
          )}

          {/* Reply Composer */}
          <EmailReplyComposer
            email={email}
            mode={replyMode}
            onClose={() => setReplyMode(null)}
          />
        </div>

        {/* Right: Customer context */}
        <div className="hidden md:flex w-[320px] lg:w-[360px] border-l border-border flex-col shrink-0 overflow-hidden">
          <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "context" | "thread")} className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b h-9 px-2 shrink-0">
              <TabsTrigger value="context" className="text-xs h-7 px-3">Customer Info</TabsTrigger>
              <TabsTrigger value="thread" className="text-xs h-7 px-3">
                All Activity ({threadComms.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="context" className="flex-1 m-0 overflow-hidden">
              <InboxCustomerContext
                senderEmail={email.senderEmail}
                senderName={email.sender}
              />
            </TabsContent>
            <TabsContent value="thread" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-2">
                  {threadComms.map((comm) => {
                    const meta = comm.metadata as Record<string, unknown> | null;
                    const isSelected = comm.id === email.id;
                    return (
                      <div
                        key={comm.id}
                        className={cn(
                          "rounded-lg border p-2.5 text-xs space-y-1 transition-colors",
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium truncate">{comm.from.split("<")[0].trim()}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {comm.receivedAt ? new Date(comm.receivedAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <p className="text-muted-foreground truncate">{comm.subject || "(no subject)"}</p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
