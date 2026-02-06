import { useState } from "react";
import { X, ExternalLink, Sparkles, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { InboxEmail } from "./InboxEmailList";

interface InboxEmailViewerProps {
  email: InboxEmail | null;
  onClose: () => void;
}

export function InboxEmailViewer({ email, onClose }: InboxEmailViewerProps) {
  const [replyText, setReplyText] = useState(
    "Hey Cassie, thanks for getting set up - let's test this out. Can you draft a quick outreach to a contractor about our ready-stock rebar bundles and prefab stirrups? Want to see how you handle our voice before we scale this up."
  );

  if (!email) return null;

  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <button className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="w-5 h-5" />
        </button>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Subject & Label */}
        <h2 className="text-xl font-semibold mb-2">{email.subject}</h2>
        <span className={cn(
          "inline-block px-2 py-0.5 rounded text-xs text-white mb-6",
          email.labelColor
        )}>
          {email.label}
        </span>

        {/* Sender Info */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="font-medium">{email.sender}</span>
            <span className="text-muted-foreground"> | {email.senderEmail}</span>
          </div>
          <span className="text-sm text-muted-foreground">{email.time}</span>
        </div>

        {/* Email Body */}
        <div className="space-y-4 text-sm mb-8">
          <p>Hi there!</p>
          <p>
            I'm Cassie, and I'm here to help you with your emails (and hopefully other sources of
            communication in the future)! I just got connected to this inbox and I'm ready to start helping
            you stay on top of things.
          </p>
          <p>Here's what I'll do:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Read through your incoming messages</li>
            <li>Categorize them into different categories</li>
            <li>Figure out which ones need responses</li>
            <li>Draft replies that sound like you</li>
          </ul>
          <p>
            Everything is set up and running smoothly. Feel free to reply to this email if you want to test
            things out!
          </p>
          <p>Cheers,</p>
          <p className="font-medium">Cassie from sintra.ai</p>
        </div>

        {/* Reply Section */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>↩</span>
              <span>cassie@sintra.ai</span>
            </div>
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Sparkles className="w-4 h-4" />
              <span>Regenerate</span>
            </button>
          </div>
          
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[100px] bg-transparent border-0 p-0 resize-none focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t">
        <Button variant="ghost" className="text-muted-foreground">
          <Trash2 className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button className="bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white">
          Send
          <Send className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
