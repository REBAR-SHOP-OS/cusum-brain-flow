import { useState } from "react";
import { Reply, Forward, Trash2, Archive, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GmailMessage, parseEmailAddress, formatDate } from "@/lib/gmail";
import { ComposeEmail } from "./ComposeEmail";

interface EmailViewerProps {
  email: GmailMessage;
  onRefresh: () => void;
}

export function EmailViewer({ email, onRefresh }: EmailViewerProps) {
  const [showReply, setShowReply] = useState(false);
  const sender = parseEmailAddress(email.from);
  const recipient = parseEmailAddress(email.to);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">{email.subject || "(no subject)"}</h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setShowReply(true)}>
              <Reply className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Forward className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {sender.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{sender.name}</span>
              <span className="text-xs text-muted-foreground">&lt;{sender.email}&gt;</span>
            </div>
            <div className="text-xs text-muted-foreground">
              to {recipient.name} • {formatDate(email.internalDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>

      {/* Quick Reply */}
      <div className="p-4 border-t border-border">
        <Button variant="outline" className="w-full" onClick={() => setShowReply(true)}>
          <Reply className="w-4 h-4 mr-2" />
          Reply to {sender.name}
        </Button>
      </div>

      {/* Reply Modal */}
      {showReply && (
        <ComposeEmail
          onClose={() => setShowReply(false)}
          onSent={onRefresh}
          replyTo={{
            to: sender.email,
            subject: email.subject,
            threadId: email.threadId,
            messageId: email.id,
          }}
        />
      )}
    </div>
  );
}
