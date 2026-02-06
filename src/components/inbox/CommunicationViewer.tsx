import { Phone, MessageSquare, Mail, PhoneIncoming, PhoneOutgoing, Clock } from "lucide-react";
import { Communication } from "@/hooks/useCommunications";
import { cn } from "@/lib/utils";

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

export function CommunicationViewer({ communication }: CommunicationViewerProps) {
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

  // Gmail email view (basic — full body requires fetching from Gmail API)
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold mb-4">{communication.subject || "(no subject)"}</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {sender.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{sender.name}</span>
              <span className="text-xs text-muted-foreground">&lt;{sender.address}&gt;</span>
            </div>
            <div className="text-xs text-muted-foreground">
              to {recipient.name} • {formatFullDate(communication.receivedAt)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {communication.preview || "(No preview available)"}
        </p>
      </div>
    </div>
  );
}
