import { useState } from "react";
import { Phone, MessageSquare, Mail, PhoneIncoming, PhoneOutgoing, Clock } from "lucide-react";
import { Communication } from "@/hooks/useCommunications";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailActionBar, type ReplyMode } from "./EmailActionBar";
import { EmailReplyComposer } from "./EmailReplyComposer";
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

export function CommunicationViewer({ communication }: CommunicationViewerProps) {
  const [replyMode, setReplyMode] = useState<ReplyMode>(null);
  const [drafting, setDrafting] = useState(false);
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
    const meta = communication.metadata ?? {};
    const duration = meta.duration as number | undefined;
    const result = meta.result as string | undefined;

    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            {communication.direction === "inbound" ? (
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <PhoneIncoming className="w-5 h-5 text-blue-500" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <PhoneOutgoing className="w-5 h-5 text-blue-500" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {communication.direction === "inbound" ? "Incoming" : "Outgoing"} Call
              </h2>
              <p className="text-sm text-muted-foreground">via RingCentral</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">From</p>
              <p className="font-medium">{sender.name}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">To</p>
              <p className="font-medium">{recipient.name}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Time</p>
              <p className="font-medium">{formatFullDate(communication.receivedAt)}</p>
            </div>
            {duration !== undefined && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
                <p className="font-medium">
                  {duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
                </p>
              </div>
            )}
            {result && (
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-1">Result</p>
                <p className={cn(
                  "font-medium capitalize",
                  result === "Missed" && "text-destructive"
                )}>{result}</p>
              </div>
            )}
          </div>
          {communication.subject && (
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Subject</p>
              <p>{communication.subject}</p>
            </div>
          )}
        </div>
      </div>
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

        <div className="flex-1 p-6 space-y-4">
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

      {/* Reply Composer */}
      <EmailReplyComposer
        email={inboxEmail}
        mode={replyMode}
        onClose={() => setReplyMode(null)}
      />
    </div>
  );
}
