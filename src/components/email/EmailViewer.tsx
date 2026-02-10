import { useState } from "react";
import DOMPurify from "dompurify";
import { Reply, Forward, Trash2, Archive, MoreHorizontal, CheckSquare, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GmailMessage, parseEmailAddress, formatDate } from "@/lib/gmail";
import { ComposeEmail } from "./ComposeEmail";
import { CreateTaskModal } from "./CreateTaskModal";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";

interface EmailViewerProps {
  email: GmailMessage;
  onRefresh: () => void;
}

export function EmailViewer({ email, onRefresh }: EmailViewerProps) {
  const [showReply, setShowReply] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const sender = parseEmailAddress(email.from);
  const recipient = parseEmailAddress(email.to);
  const { companyId } = useCompanyId();
  const { toast } = useToast();

  const handleAddToBrain = async () => {
    if (!companyId) { toast({ title: "Still loading workspace", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from("knowledge").insert({
        title: (email.subject || "Email").slice(0, 80),
        content: `Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\n\n${email.body?.replace(/<[^>]+>/g, '') || ""}`,
        category: "email",
        company_id: companyId,
      });
      if (error) throw error;
      toast({ title: "Saved to Brain" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">{email.subject || "(no subject)"}</h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={handleAddToBrain} title="Add to Brain">
              <Brain className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowCreateTask(true)} title="Create Task">
              <CheckSquare className="w-4 h-4" />
            </Button>
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
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(email.body, {
              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
              ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style'],
              FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
              FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
            })
          }}
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
            originalBody: email.body,
          }}
        />
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          email={email}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
