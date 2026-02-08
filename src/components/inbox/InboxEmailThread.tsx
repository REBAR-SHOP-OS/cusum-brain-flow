import { useMemo } from "react";
import DOMPurify from "dompurify";
import { FileText, Image, File, ExternalLink, Mail, Phone, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import type { Communication } from "@/hooks/useCommunications";
import { InlineCallSummary } from "./InlineCallSummary";

interface ThreadEntry {
  id: string;
  from: string;
  fromEmail: string;
  to: string;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string;
  date: Date;
  type: "email" | "call" | "sms";
  attachments: { name: string; url: string; type: string }[];
  // Call-specific fields
  duration?: number;
  callResult?: string;
  recordingUri?: string;
  hasRecording?: boolean;
}

interface InboxEmailThreadProps {
  communications: Communication[];
  currentEmailId: string;
}

function extractSenderName(fromAddress: string): string {
  const match = fromAddress.match(/^([^<]+)</);
  if (match) return match[1].trim();
  const emailMatch = fromAddress.match(/([^@]+)@/);
  if (emailMatch) return emailMatch[1].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return fromAddress;
}

function extractEmail(fromAddress: string): string {
  const match = fromAddress.match(/<([^>]+)>/);
  if (match) return match[1];
  return fromAddress;
}

function extractAttachments(body: string): { name: string; url: string; type: string }[] {
  const attachments: { name: string; url: string; type: string }[] = [];
  if (!body) return attachments;

  const anchorRegex = /<a[^>]+href="(https?:\/\/[^"]*\.(pdf|png|jpg|jpeg|gif|doc|docx|xls|xlsx|csv|dwg|zip)[^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(body)) !== null) {
    const url = match[1];
    const ext = match[2].toLowerCase();
    const linkText = match[3].trim();
    const fileName = linkText || decodeURIComponent(url.split("/").pop()?.split("?")[0] || "File");
    if (attachments.some((a) => a.url === url)) continue;
    const type = ext === "pdf" ? "pdf" : ["png", "jpg", "jpeg", "gif"].includes(ext) ? "image" : "document";
    attachments.push({ name: fileName, url, type });
  }

  // Numbered link references
  const numberedRegex = /\[(\d+)\]\s*(https?:\/\/\S+\.(pdf|png|jpg|jpeg|gif|doc|docx|xls|xlsx|csv|dwg|zip)\S*)/gi;
  while ((match = numberedRegex.exec(body)) !== null) {
    const url = match[2];
    if (attachments.some((a) => a.url === url)) continue;
    const ext = match[3].toLowerCase();
    const fileName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || `File ${match[1]}`);
    const type = ext === "pdf" ? "pdf" : ["png", "jpg", "jpeg", "gif"].includes(ext) ? "image" : "document";
    attachments.push({ name: fileName, url, type });
  }

  return attachments;
}

function getAttachmentIcon(type: string) {
  switch (type) {
    case "pdf": return <FileText className="w-3.5 h-3.5 text-red-500" />;
    case "image": return <Image className="w-3.5 h-3.5 text-blue-500" />;
    case "document": return <File className="w-3.5 h-3.5 text-amber-500" />;
    default: return <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />;
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

function formatDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

/**
 * Detect if text is plain text (no HTML tags) and convert to presentable HTML.
 * Handles: line breaks, *bold*, numbered link refs [N] url, bare URLs
 */
function isPlainText(str: string): boolean {
  // If it contains common HTML tags it's probably HTML
  return !/<\s*(div|p|br|table|tr|td|span|a |img |h[1-6]|ul|ol|li|blockquote|strong|em|b |i )[^>]*>/i.test(str);
}

function plainTextToHtml(text: string): string {
  let html = text;

  // Escape HTML entities first
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Remove numbered link references at the end (e.g., [1] https://...)
  // and collect them for inline linking
  const linkMap = new Map<string, string>();
  html = html.replace(/\[(\d+)\]\s*(https?:\/\/[^\s]+)/g, (_, num, url) => {
    linkMap.set(num, url);
    return ""; // Remove from body
  });

  // Replace inline [N] references with clickable links if we have the URL
  linkMap.forEach((url, num) => {
    const regex = new RegExp(`\\[${num}\\]`, "g");
    html = html.replace(regex, `<a href="${url}" target="_blank" rel="noopener noreferrer">[${num}]</a>`);
  });

  // Convert *text* to bold
  html = html.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");

  // Convert bare URLs to links
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // Convert email addresses to mailto links
  html = html.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');

  // Convert newlines to <br>
  html = html.replace(/\r?\n/g, "<br>");

  // Clean up excessive <br> runs
  html = html.replace(/(<br>){3,}/g, "<br><br>");

  // Remove empty trailing lines
  html = html.replace(/(<br>\s*)+$/, "");

  return html;
}

// Assign consistent colors to senders
const AVATAR_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

function getSenderColor(email: string, colorMap: Map<string, string>): string {
  if (!colorMap.has(email)) {
    colorMap.set(email, AVATAR_COLORS[colorMap.size % AVATAR_COLORS.length]);
  }
  return colorMap.get(email)!;
}

export function InboxEmailThread({ communications, currentEmailId }: InboxEmailThreadProps) {
  const { entries, colorMap } = useMemo(() => {
    const map = new Map<string, string>();
    const list: ThreadEntry[] = communications.map((comm) => {
      const meta = comm.metadata as Record<string, unknown> | null;
      const fullBody = (meta?.body as string) || comm.preview || "";
      return {
        id: comm.id,
        from: extractSenderName(comm.from),
        fromEmail: extractEmail(comm.from),
        to: comm.to,
        direction: comm.direction,
        subject: comm.subject,
        body: fullBody,
        date: new Date(comm.receivedAt),
        type: comm.type,
        attachments: extractAttachments(fullBody),
        // Call metadata
        duration: meta?.duration as number | undefined,
        callResult: meta?.result as string | undefined,
        recordingUri: meta?.recording_uri as string | undefined,
        hasRecording: !!meta?.recording_id,
      };
    });

    // Sort oldest first (timeline order)
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    // Build color map
    list.forEach((e) => getSenderColor(e.fromEmail, map));

    return { entries: list, colorMap: map };
  }, [communications]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-8">
        <Mail className="w-8 h-8 opacity-30" />
        <p className="text-sm">No conversation history</p>
      </div>
    );
  }

  // Group by date
  const dateGroups: { label: string; entries: ThreadEntry[] }[] = [];
  entries.forEach((entry) => {
    const lastGroup = dateGroups[dateGroups.length - 1];
    if (lastGroup && isSameDay(lastGroup.entries[0].date, entry.date)) {
      lastGroup.entries.push(entry);
    } else {
      dateGroups.push({ label: formatDateLabel(entry.date), entries: [entry] });
    }
  });

  return (
    <div className="flex flex-col gap-0 px-4 py-4">
      {dateGroups.map((group, gi) => (
        <div key={gi}>
          {/* Date separator */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-[11px] font-medium text-muted-foreground px-2">{group.label}</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Messages in this date */}
          <div className="space-y-4">
            {group.entries.map((entry) => {
              const isCurrent = entry.id === currentEmailId;
              const isOutbound = entry.direction === "outbound";
              const senderColor = getSenderColor(entry.fromEmail, colorMap);

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex gap-3",
                    isCurrent && "ring-1 ring-primary/30 rounded-lg bg-primary/5 p-3 -mx-3"
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5",
                    senderColor
                  )}>
                    {entry.from.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{entry.from}</span>
                      {entry.type !== "email" && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {entry.type === "call" ? <Phone className="w-2.5 h-2.5" /> : <Mail className="w-2.5 h-2.5" />}
                          {entry.type}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {format(entry.date, "h:mm a")}
                      </span>
                      {isOutbound && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <ArrowUpRight className="w-2.5 h-2.5" /> sent
                        </span>
                      )}
                      {!isOutbound && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <ArrowDownLeft className="w-2.5 h-2.5" /> received
                        </span>
                      )}
                    </div>

                    {/* Subject (if different from thread) */}
                    {entry.subject && (
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">{entry.subject}</p>
                    )}

                    {/* Body — branch by type */}
                    {entry.type === "call" ? (
                      <div className="mt-2">
                        <InlineCallSummary
                          direction={entry.direction}
                          fromName={entry.from}
                          toName={extractSenderName(entry.to)}
                          duration={entry.duration}
                          result={entry.callResult}
                          recordingUri={entry.recordingUri}
                          hasRecording={!!entry.hasRecording}
                          date={format(entry.date, "PPp")}
                        />
                      </div>
                    ) : (
                      <>
                        {/* Email / SMS Body */}
                        <div className="mt-2 rounded-lg border border-border overflow-hidden">
                          <div
                            className="p-3 bg-white text-zinc-900 text-sm [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_table]:border-collapse [&_td]:p-1"
                            style={{ lineHeight: "1.5" }}
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(
                                isPlainText(entry.body) ? plainTextToHtml(entry.body) : entry.body,
                                {
                                  ALLOWED_TAGS: ["p","br","strong","em","u","a","ul","ol","li","blockquote","div","span","h1","h2","h3","h4","h5","h6","img","table","thead","tbody","tr","td","th","hr","b","i","font","center","pre","code"],
                                  ALLOWED_ATTR: ["href","target","rel","src","alt","class","style","width","height","border","cellpadding","cellspacing","align","valign","color","bgcolor","colspan","rowspan"],
                                  FORBID_TAGS: ["script","iframe","object","embed","form"],
                                  FORBID_ATTR: ["onerror","onload","onclick","onmouseover"],
                                }
                              ),
                            }}
                          />
                        </div>

                        {/* Attachments */}
                        {entry.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {entry.attachments.map((att, ai) => (
                              <a
                                key={ai}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer",
                                  getAttachmentBg(att.type)
                                )}
                              >
                                {getAttachmentIcon(att.type)}
                                <span className="max-w-[160px] truncate text-foreground">{att.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
