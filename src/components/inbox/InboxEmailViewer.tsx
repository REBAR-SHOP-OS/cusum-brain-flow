import { useState } from "react";
import DOMPurify from "dompurify";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailActionBar, type ReplyMode } from "./EmailActionBar";
import { EmailReplyComposer } from "./EmailReplyComposer";
import { AddToTaskButton } from "@/components/shared/AddToTaskButton";
import { CreateTaskDialog } from "@/components/shared/CreateTaskDialog";
import type { InboxEmail } from "./InboxEmailList";

interface InboxEmailViewerProps {
  email: InboxEmail | null;
  onClose: () => void;
}

export function InboxEmailViewer({ email, onClose }: InboxEmailViewerProps) {
  const [replyMode, setReplyMode] = useState<ReplyMode>(null);
  const [drafting, setDrafting] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const { toast } = useToast();

  const handleSmartReply = async () => {
    if (!email) return;
    setReplyMode("reply");
    setDrafting(true);

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

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Mail className="w-10 h-10 opacity-30" />
        <p className="text-sm">Select an email to read</p>
      </div>
    );
  }

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

      {/* Email Content - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 max-w-3xl">
          {/* Subject */}
          <h2 className="text-lg font-semibold mb-4">{email.subject}</h2>

          {/* Label */}
          <span className={cn(
            "inline-block px-2 py-0.5 rounded text-xs text-white mb-4",
            email.labelColor
          )}>
            {email.label}
          </span>

          {/* Sender Info */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0",
                email.isUnread ? "bg-green-500" : "bg-muted-foreground/50"
              )}>
                {email.sender.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{email.sender}</span>
                  <span className="text-xs text-muted-foreground">&lt;{email.senderEmail}&gt;</span>
                </div>
                <p className="text-xs text-muted-foreground">To: {email.toAddress}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{email.fullDate}</span>
          </div>

          {/* Divider */}
          <div className="border-b my-4" />

          {/* Email Body */}
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(email.body || email.preview || "", {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'width', 'height'],
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
              })
            }}
          />
        </div>
      </div>

      {/* Add to Task (shown when no reply composer) */}
      {!replyMode && (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <AddToTaskButton
            defaults={{
              title: `Follow up: ${email.subject}`,
              description: email.preview || "",
              source: "email",
              sourceRef: email.sourceId || email.id,
            }}
            className="w-full"
          />
        </div>
      )}

      {/* Reply Composer */}
      <EmailReplyComposer
        email={email}
        mode={replyMode}
        onClose={() => setReplyMode(null)}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        defaults={{
          title: `Follow up: ${email.subject}`,
          description: email.preview || "",
          source: "email",
          sourceRef: email.sourceId || email.id,
        }}
      />
    </div>
  );
}
