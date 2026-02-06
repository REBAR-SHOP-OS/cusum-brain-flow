import { useState } from "react";
import { ArrowLeft, RefreshCw, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InboxEmailList, type InboxEmail } from "./InboxEmailList";
import { InboxEmailViewer } from "./InboxEmailViewer";
import { InboxManagerSettings } from "./InboxManagerSettings";

const mockEmails: InboxEmail[] = [
  {
    id: "1",
    sender: "Cassie From Sintra.ai",
    senderEmail: "cassie@sintra.ai",
    subject: "Welcome! I'm here to help with your emails",
    preview: "Hi there! I'm Cassie, and I'm here to help you with your emails (and...",
    time: "4:05 AM",
    label: "To Respond",
    labelColor: "bg-red-400",
    isUnread: true,
  },
];

interface InboxViewProps {
  connectedEmail?: string;
}

export function InboxView({ connectedEmail = "ai@rebar.shop" }: InboxViewProps) {
  const navigate = useNavigate();
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(mockEmails[0]);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-full bg-muted/30">
      {/* Email List Panel */}
      <div className="w-[400px] bg-background border-r flex flex-col">
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
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
              <RefreshCw className="w-5 h-5" />
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

        {/* Email List */}
        <InboxEmailList
          emails={mockEmails}
          selectedId={selectedEmail?.id ?? null}
          onSelect={setSelectedEmail}
        />
      </div>

      {/* Email Viewer */}
      <div className="flex-1">
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
