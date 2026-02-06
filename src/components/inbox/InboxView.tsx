import { useState } from "react";
import { ArrowLeft, RefreshCw, Settings, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InboxEmailList, type InboxEmail } from "./InboxEmailList";
import { InboxEmailViewer } from "./InboxEmailViewer";
import { InboxManagerSettings } from "./InboxManagerSettings";
import { useCommunications } from "@/hooks/useCommunications";
import { format } from "date-fns";

function categorizeEmail(from: string, subject: string, preview: string): { label: string; labelColor: string } {
  const fromLower = from.toLowerCase();
  const subjectLower = (subject || "").toLowerCase();
  const previewLower = (preview || "").toLowerCase();

  // Delivery failures / notifications
  if (fromLower.includes("mailer-daemon") || fromLower.includes("postmaster") || subjectLower.includes("delivery status")) {
    return { label: "Notification", labelColor: "bg-cyan-400" };
  }

  // Automated / marketing / newsletters
  if (fromLower.includes("noreply") || fromLower.includes("no-reply") || fromLower.includes("newsletter") || fromLower.includes("alibaba") || fromLower.includes("marketing")) {
    return { label: "Marketing", labelColor: "bg-pink-400" };
  }

  // Security / access codes
  if (subjectLower.includes("security") || subjectLower.includes("access code") || subjectLower.includes("verification")) {
    return { label: "Notification", labelColor: "bg-cyan-400" };
  }

  // Financial / invoices
  if (subjectLower.includes("invoice") || subjectLower.includes("payment") || subjectLower.includes("transfer") || subjectLower.includes("interac")) {
    return { label: "FYI", labelColor: "bg-amber-400" };
  }

  // Support cases
  if (subjectLower.includes("support case") || subjectLower.includes("ticket")) {
    return { label: "Awaiting Reply", labelColor: "bg-amber-400" };
  }

  // Phone calls (RingCentral)
  if (subjectLower.includes("call")) {
    return { label: "Call Log", labelColor: "bg-violet-400" };
  }

  // Default: likely needs a response
  return { label: "To Respond", labelColor: "bg-red-400" };
}

function extractSenderName(fromAddress: string): string {
  // Extract name from "Name <email>" format
  const match = fromAddress.match(/^([^<]+)</);
  if (match) return match[1].trim();
  // Extract name from email
  const emailMatch = fromAddress.match(/([^@]+)@/);
  if (emailMatch) return emailMatch[1].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return fromAddress;
}

function extractEmail(fromAddress: string): string {
  const match = fromAddress.match(/<([^>]+)>/);
  if (match) return match[1];
  return fromAddress;
}

interface InboxViewProps {
  connectedEmail?: string;
}

export function InboxView({ connectedEmail = "sattar@rebar.shop" }: InboxViewProps) {
  const navigate = useNavigate();
  const { communications, loading, sync } = useCommunications({ typeFilter: "email" });
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Map real communications to InboxEmail format
  const emails: InboxEmail[] = communications.map((comm) => {
    const category = categorizeEmail(comm.from, comm.subject || "", comm.preview || "");
    const meta = comm.metadata as Record<string, unknown> | null;
    const fullBody = (meta?.body as string) || comm.preview || "";
    const receivedDate = comm.receivedAt ? new Date(comm.receivedAt) : null;

    return {
      id: comm.id,
      sender: extractSenderName(comm.from),
      senderEmail: extractEmail(comm.from),
      toAddress: comm.to,
      subject: comm.subject || "(no subject)",
      preview: comm.preview || "",
      body: fullBody,
      time: receivedDate ? format(receivedDate, "h:mm a") : "",
      fullDate: receivedDate ? format(receivedDate, "MMM d, h:mm a") : "",
      label: category.label,
      labelColor: category.labelColor,
      isUnread: comm.status === "unread",
      threadId: comm.threadId || undefined,
      sourceId: comm.sourceId,
    };
  });

  const handleSync = async () => {
    setSyncing(true);
    await sync();
    setSyncing(false);
  };

  return (
    <div className="flex h-full bg-muted/30">
      {/* Email List Panel */}
      <div className="w-[400px] bg-background border-r flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/integrations")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Inbox</h1>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Email Count */}
        <div className="px-4 py-2 text-xs text-muted-foreground border-b">
          {emails.length} email{emails.length !== 1 ? "s" : ""}
        </div>

        {/* Email List */}
        <InboxEmailList
          emails={emails}
          selectedId={selectedEmail?.id ?? null}
          onSelect={setSelectedEmail}
        />
      </div>

      {/* Email Viewer */}
      <div className="flex-1 min-h-0">
        <InboxEmailViewer 
          email={selectedEmail} 
          onClose={() => setSelectedEmail(null)} 
        />
      </div>

      {/* Settings Panel */}
      <InboxManagerSettings
        open={showSettings}
        onOpenChange={setShowSettings}
        connectedEmail={connectedEmail}
      />
    </div>
  );
}
