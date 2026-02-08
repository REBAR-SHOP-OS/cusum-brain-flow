import { useState, useMemo } from "react";
import DOMPurify from "dompurify";
import { Mail, FileText, Image, File, ExternalLink } from "lucide-react";
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

// Extract attachment-like links from email body
function extractAttachments(body: string): { name: string; url: string; type: string }[] {
  const attachments: { name: string; url: string; type: string }[] = [];
  if (!body) return attachments;

  // Match markdown-style numbered links: [N] https://...
  const numberedLinkRegex = /\[(\d+)\]\s*(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = numberedLinkRegex.exec(body)) !== null) {
    const url = match[2];
    // Skip common non-attachment links
    if (url.includes("unsubscribe") || url.includes("mailto:") || url.includes("odoo.com?utm")) continue;
    const fileName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || `Link ${match[1]}`);
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const type = ["pdf"].includes(ext) ? "pdf" 
      : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? "image"
      : ["doc", "docx", "xls", "xlsx", "csv"].includes(ext) ? "document"
      : "link";
    attachments.push({ name: fileName, url, type });
  }

  // Match <a> tags with file-like hrefs
  const anchorRegex = /<a[^>]+href="(https?:\/\/[^"]*\.(pdf|png|jpg|jpeg|gif|doc|docx|xls|xlsx|csv|dwg|zip)[^"]*)"[^>]*>([^<]*)<\/a>/gi;
  while ((match = anchorRegex.exec(body)) !== null) {
    const url = match[1];
    const ext = match[2].toLowerCase();
    const linkText = match[3].trim();
    const fileName = linkText || decodeURIComponent(url.split("/").pop()?.split("?")[0] || "File");
    // Avoid duplicates
    if (attachments.some(a => a.url === url)) continue;
    const type = ext === "pdf" ? "pdf" 
      : ["png", "jpg", "jpeg", "gif"].includes(ext) ? "image"
      : "document";
    attachments.push({ name: fileName, url, type });
  }

  return attachments;
}

function getAttachmentIcon(type: string) {
  switch (type) {
    case "pdf": return <FileText className="w-4 h-4 text-red-500" />;
    case "image": return <Image className="w-4 h-4 text-blue-500" />;
    case "document": return <File className="w-4 h-4 text-amber-500" />;
    default: return <ExternalLink className="w-4 h-4 text-muted-foreground" />;
  }
}

function getAttachmentBg(type: string) {
  switch (type) {
    case "pdf": return "bg-red-500/10 border-red-500/20 hover:bg-red-500/15";
    case "image": return "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15";
    case "document": return "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15";
    default: return "bg-muted/50 border-border hover:bg-muted";
  }
}

export function InboxEmailViewer({ email, onClose }: InboxEmailViewerProps) {
  const [replyMode, setReplyMode] = useState<ReplyMode>(null);
  const [drafting, setDrafting] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const { toast } = useToast();

  const attachments = useMemo(() => {
    if (!email) return [];
    return extractAttachments(email.body || "");
  }, [email]);

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

          {/* Email Body — light bg container for HTML emails */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div
              className="p-4 bg-white text-zinc-900 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_table]:border-collapse [&_td]:p-1 [&_th]:p-1"
              style={{ fontSize: '14px', lineHeight: '1.6' }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(email.body || email.preview || "", {
                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'b', 'i', 'font', 'center', 'pre', 'code'],
                  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'color', 'bgcolor', 'colspan', 'rowspan'],
                  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
                })
              }}
            />
          </div>

          {/* Attachments — Odoo-style file chips */}
          {attachments.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Attachments ({attachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors cursor-pointer",
                      getAttachmentBg(att.type)
                    )}
                  >
                    {getAttachmentIcon(att.type)}
                    <span className="max-w-[180px] truncate text-foreground">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
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
