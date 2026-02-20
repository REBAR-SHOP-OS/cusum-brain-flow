import { useState } from "react";
import { Phone, MessageSquare, Mail, PhoneIncoming, PhoneOutgoing, Clock, Brain, Loader2, Sparkles, Play, Pause, Volume2, FileText } from "lucide-react";
import { Communication } from "@/hooks/useCommunications";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Button } from "@/components/ui/button";
import { EmailActionBar, type ReplyMode } from "./EmailActionBar";
import { EmailReplyComposer } from "./EmailReplyComposer";
import { AddToTaskButton } from "@/components/shared/AddToTaskButton";
import { CreateTaskDialog } from "@/components/shared/CreateTaskDialog";
import { Badge } from "@/components/ui/badge";
import { CallDetailView } from "./CallDetailView";
import { VoicemailPlayer } from "./VoicemailPlayer";
import { FaxViewer } from "./FaxViewer";
import type { InboxEmail } from "./InboxEmailList";

interface CommunicationViewerProps {
  communication: Communication | null;
}

function parseDisplayName(raw: string): { name: string; address: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) return { name: match[1] || match[2], address: match[2] };
  return { name: raw, address: raw };
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convert a Communication to InboxEmail shape for the reply composer */
function toInboxEmail(comm: Communication): InboxEmail {
  const sender = parseDisplayName(comm.from);
  const meta = comm.metadata as Record<string, unknown> | null;
  const fullBody = (meta?.body as string) || comm.preview || "";

  return {
    id: comm.id,
    sender: sender.name,
    senderEmail: sender.address,
    toAddress: comm.to,
    subject: comm.subject || "(no subject)",
    preview: comm.preview || "",
    body: fullBody,
    time: "",
    fullDate: formatFullDate(comm.receivedAt),
    label: "",
    labelColor: "",
    isUnread: comm.status === "unread",
    threadId: comm.threadId || undefined,
    sourceId: comm.sourceId,
  };
}

/** Shared "Add to Brain" button */
function AddToBrainButton({ communication }: { communication: Communication }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const { companyId } = useCompanyId();

  const handleAddToBrain = async () => {
    setSaving(true);
    try {
      const sender = parseDisplayName(communication.from);
      const meta = communication.metadata as Record<string, unknown> | null;
      const body = (meta?.body as string) || communication.preview || "";

      const title = communication.type === "email"
        ? communication.subject || "(no subject)"
        : communication.type === "call"
          ? `${communication.direction === "inbound" ? "Incoming" : "Outgoing"} call – ${sender.name}`
          : `SMS – ${sender.name}`;

      const content = communication.type === "email"
        ? `From: ${sender.name} <${sender.address}>\nTo: ${communication.to}\nDate: ${formatFullDate(communication.receivedAt)}\nSubject: ${communication.subject || "(no subject)"}\n\n${body}`
        : communication.type === "call"
          ? `${communication.direction === "inbound" ? "Incoming" : "Outgoing"} call from ${sender.name} on ${formatFullDate(communication.receivedAt)}${(meta?.duration as number) ? ` (${Math.floor((meta.duration as number) / 60)}m ${(meta.duration as number) % 60}s)` : ""}${(meta?.result as string) ? ` - ${meta.result}` : ""}`
          : `SMS from ${sender.name} on ${formatFullDate(communication.receivedAt)}\n\n${communication.preview || ""}`;

      const { error } = await supabase.from("knowledge").insert({
        title,
        content,
        category: "memory",
        source_url: null,
        company_id: companyId!,
        metadata: {
          source_type: communication.type,
          source_id: communication.sourceId,
          from: communication.from,
          to: communication.to,
          date: communication.receivedAt,
        },
      });

      if (error) throw error;

      setSaved(true);
      toast({ title: "Added to Brain", description: "This conversation has been saved to your Brain AI knowledge." });
    } catch (err) {
      console.error("Add to Brain error:", err);
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const taskDefaults = {
    title: communication.type === "email"
      ? `Follow up: ${communication.subject || "(no subject)"}`
      : communication.type === "call"
        ? `Follow up: ${communication.direction === "inbound" ? "Incoming" : "Outgoing"} call – ${parseDisplayName(communication.from).name}`
        : `Follow up: SMS – ${parseDisplayName(communication.from).name}`,
    description: communication.preview || "",
    source: communication.type,
    sourceRef: communication.sourceId,
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-3 flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 flex-1"
        onClick={handleAddToBrain}
        disabled={saving || saved}
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Brain className="w-4 h-4 text-primary" />
        )}
        {saved ? "Added to Brain" : saving ? "Saving..." : "Add to Brain"}
      </Button>
      <AddToTaskButton defaults={taskDefaults} className="flex-1" />
    </div>
  );
}

export function CommunicationViewer({ communication }: CommunicationViewerProps) {
  const [replyMode, setReplyMode] = useState<ReplyMode>(null);
  const [drafting, setDrafting] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const { toast } = useToast();

  const handleSmartReply = async () => {
    if (!communication) return;
    setReplyMode("reply");
    setDrafting(true);

    try {
      const sender = parseDisplayName(communication.from);
      const meta = communication.metadata as Record<string, unknown> | null;
      const body = (meta?.body as string) || communication.preview || "";

      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          emailSubject: communication.subject,
          emailBody: body,
          senderName: sender.name,
          senderEmail: sender.address,
        },
      });
      if (error) throw error;
      if (data?.draft) {
        toast({ title: "Smart Reply ready", description: "AI draft generated — review before sending." });
      }
    } catch (err) {
      console.error("Smart reply error:", err);
      toast({
        title: "Failed to generate smart reply",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDrafting(false);
    }
  };

  if (!communication) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a message to read</p>
        </div>
      </div>
    );
  }

  const sender = parseDisplayName(communication.from);
  const recipient = parseDisplayName(communication.to);

  // RingCentral Call view
  if (communication.type === "call") {
    return (
      <CallDetailView
        communication={communication}
        footer={<AddToBrainButton communication={communication} />}
      />
    );
  }

  // RingCentral SMS view
  if (communication.type === "sms") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">SMS Message</h2>
              <p className="text-sm text-muted-foreground">via RingCentral</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>From: {sender.name}</span>
            <span>{formatFullDate(communication.receivedAt)}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <span>To: {recipient.name}</span>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50 mt-4">
            <p className="text-sm whitespace-pre-wrap">
              {communication.preview || communication.subject || "(empty message)"}
            </p>
          </div>
        </div>
        <AddToBrainButton communication={communication} />
      </div>
    );
  }

  // Voicemail view
  if (communication.type === "voicemail") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Voicemail</h2>
              <p className="text-sm text-muted-foreground">via RingCentral</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>From: {sender.name}</span>
            <span>{formatFullDate(communication.receivedAt)}</span>
          </div>
          <VoicemailPlayer communication={communication} />
        </div>
        <AddToBrainButton communication={communication} />
      </div>
    );
  }

  // Fax view
  if (communication.type === "fax") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Fax Document</h2>
              <p className="text-sm text-muted-foreground">via RingCentral</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>From: {sender.name}</span>
            <span>{formatFullDate(communication.receivedAt)}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <span>To: {recipient.name}</span>
          </div>
          <FaxViewer communication={communication} />
        </div>
        <AddToBrainButton communication={communication} />
      </div>
    );
  }

  // Gmail email view with reply/forward/smart reply
  const inboxEmail = toInboxEmail(communication);
  const meta = communication.metadata as Record<string, unknown> | null;
  const fullBody = (meta?.body as string) || communication.preview || "";

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Action Bar */}
      <EmailActionBar
        activeMode={replyMode}
        onModeChange={setReplyMode}
        onSmartReply={handleSmartReply}
        onCreateTask={() => setShowTaskDialog(true)}
        drafting={drafting}
      />

      {/* Email Content - scrollable, shrinks when composer is open */}
      <div className="flex-1 overflow-y-auto min-h-0 shrink">
        <div className="p-4 sm:p-6 max-w-3xl">
          {/* Subject */}
          <h2 className="text-lg font-semibold mb-4">{communication.subject || "(no subject)"}</h2>

          {/* Sender Info */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium shrink-0">
                {sender.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{sender.name}</span>
                  <span className="text-xs text-muted-foreground">&lt;{sender.address}&gt;</span>
                </div>
                <p className="text-xs text-muted-foreground">To: {recipient.name}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatFullDate(communication.receivedAt)}
            </span>
          </div>

          {/* Divider */}
          <div className="border-b my-4" />

          {/* Email Body */}
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
            {fullBody}
          </div>
        </div>
      </div>

      {/* Add to Brain (shown when no reply composer) */}
      {!replyMode && <AddToBrainButton communication={communication} />}

      {/* Reply Composer */}
      <EmailReplyComposer
        email={inboxEmail}
        mode={replyMode}
        onClose={() => setReplyMode(null)}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        defaults={{
          title: `Follow up: ${communication.subject || "(no subject)"}`,
          description: communication.preview || "",
          source: "email",
          sourceRef: communication.sourceId,
        }}
      />
    </div>
  );
}
