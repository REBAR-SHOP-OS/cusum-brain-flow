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

/** Detect plain text (no HTML tags) */
function isPlainText(str: string): boolean {
  return !/<\s*(div|p|br|table|tr|td|span|a |img |h[1-6]|ul|ol|li|blockquote|strong|em|b |i )[^>]*>/i.test(str);
}

/** Convert plain text email to presentable HTML */
function plainTextToHtml(text: string): string {
  let html = text;
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Collect numbered link refs [N] url
  const linkMap = new Map<string, string>();
  html = html.replace(/\[(\d+)\]\s*(https?:\/\/[^\s]+)/g, (_, num, url) => {
    linkMap.set(num, url);
    return "";
  });
  linkMap.forEach((url, num) => {
    html = html.replace(new RegExp(`\\[${num}\\]`, "g"), `<a href="${url}" target="_blank" rel="noopener noreferrer">[${num}]</a>`);
  });

  html = html.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');
  html = html.replace(/\r?\n/g, "<br>");
  html = html.replace(/(<br>){3,}/g, "<br><br>");
  html = html.replace(/(<br>\s*)+$/, "");
  return html;
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

          {/* Email Body — modern styled container */}
          <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
            <div
              className="p-6 bg-white text-zinc-800 [&_a]:text-cyan-600 [&_a]:underline [&_a:hover]:text-cyan-700 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_table]:border-collapse [&_td]:p-1.5 [&_th]:p-1.5 [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-500 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1 [&_hr]:border-zinc-200 [&_hr]:my-4 [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono"
              style={{ fontSize: '14px', lineHeight: '1.7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  isPlainText(email.body || email.preview || "") 
                    ? plainTextToHtml(email.body || email.preview || "")
                    : (email.body || email.preview || ""),
                  {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'b', 'i', 'font', 'center', 'pre', 'code'],
                    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'color', 'bgcolor', 'colspan', 'rowspan'],
                    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
                  }
                )
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
