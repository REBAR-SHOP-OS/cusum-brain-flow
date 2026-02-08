import { useMemo } from "react";
import { Mail, Download, Trash2 } from "lucide-react";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { useState } from "react";
import type { Json } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeadEmailThreadProps {
  metadata: Json | null;
  notes: string | null;
  source: string | null;
}

interface EmailMeta {
  email_subject?: string;
  email_body?: string;
  email_from?: string;
  email_to?: string;
  email_date?: string;
  files?: FileEntry[];
  attachment_count?: number;
}

interface FileEntry {
  type?: "attachment" | "link";
  filename: string;
  url?: string;
  path?: string;
  mimeType?: string;
  size?: number;
}

interface ThreadMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  date: Date;
  body: string;
  quotedReply?: string;
  files: FileEntry[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractName(raw: string): string {
  const match = raw.match(/^(.+?)\s*<[^>]+>$/);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : raw.split("@")[0];
}

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1] : raw;
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-emerald-600", "bg-blue-600", "bg-amber-600", "bg-rose-600",
  "bg-violet-600", "bg-cyan-600", "bg-orange-600", "bg-teal-600",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function parseField(notes: string | null, field: string): string | null {
  if (!notes) return null;
  const regex = new RegExp(`${field}:\\s*([^|]+)`);
  const match = notes.match(regex);
  return match ? match[1].trim() : null;
}

function detectQuote(body: string): { main: string; quote: string | null } {
  // Look for common reply patterns
  const patterns = [
    /\n\s*>+\s*/,                         // > quoted lines
    /\nOn .+wrote:\s*\n/i,                // "On ... wrote:"
    /\n-{3,}\s*Original Message/i,        // --- Original Message
    /\n_{3,}\s*\n/,                       // ___ separator
  ];

  for (const pattern of patterns) {
    const idx = body.search(pattern);
    if (idx > 20) {
      return {
        main: body.substring(0, idx).trim(),
        quote: body.substring(idx).trim(),
      };
    }
  }

  return { main: body, quote: null };
}

function formatDate(d: Date): string {
  return format(d, "MMMM d, yyyy");
}

function relativeTime(d: Date): string {
  return formatDistanceToNow(d, { addSuffix: true });
}

/* ------------------------------------------------------------------ */
/*  File type config                                                   */
/* ------------------------------------------------------------------ */

interface FileTypeConfig {
  icon: string;
  label: string;
  bgColor: string;
  textColor: string;
}

function getFileTypeConfig(filename: string, mimeType?: string): FileTypeConfig {
  const ext = (filename.split(".").pop() || "").toLowerCase();

  const map: Record<string, FileTypeConfig> = {
    xls: { icon: "X", label: "XLS", bgColor: "bg-emerald-600", textColor: "text-white" },
    xlsx: { icon: "X", label: "XLSX", bgColor: "bg-emerald-600", textColor: "text-white" },
    csv: { icon: "X", label: "CSV", bgColor: "bg-emerald-600", textColor: "text-white" },
    pdf: { icon: "P", label: "PDF", bgColor: "bg-red-600", textColor: "text-white" },
    dwg: { icon: "◎", label: "DWG", bgColor: "bg-sky-600", textColor: "text-white" },
    dxf: { icon: "◎", label: "DXF", bgColor: "bg-sky-600", textColor: "text-white" },
    doc: { icon: "W", label: "DOC", bgColor: "bg-blue-700", textColor: "text-white" },
    docx: { icon: "W", label: "DOCX", bgColor: "bg-blue-700", textColor: "text-white" },
    png: { icon: "🖼", label: "PNG", bgColor: "bg-purple-600", textColor: "text-white" },
    jpg: { icon: "🖼", label: "JPG", bgColor: "bg-purple-600", textColor: "text-white" },
    jpeg: { icon: "🖼", label: "JPEG", bgColor: "bg-purple-600", textColor: "text-white" },
  };

  return map[ext] || { icon: "📎", label: ext.toUpperCase() || "FILE", bgColor: "bg-muted-foreground", textColor: "text-white" };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{date}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function FileCard({ file, onDelete }: { file: FileEntry; onDelete?: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const config = getFileTypeConfig(file.filename, file.mimeType);

  const handleDownload = async () => {
    if (file.url) {
      window.open(file.url, "_blank");
      return;
    }
    if (!file.path) return;
    setDownloading(true);
    try {
      const url = await getSignedFileUrl(file.path);
      if (url) window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/40 transition-colors group min-w-0">
      {/* Type icon */}
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold", config.bgColor, config.textColor)}>
        {config.icon}
      </div>

      {/* File info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate leading-tight">{file.filename}</p>
        <p className="text-xs text-muted-foreground">{config.label}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {onDelete && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          disabled={downloading || (!file.path && !file.url)}
          onClick={handleDownload}
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ThreadMessage }) {
  const { main, quote } = detectQuote(message.body);
  const avatarColor = colorForName(message.senderName);

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
        <AvatarFallback className={cn("text-xs font-bold text-white", avatarColor)}>
          {getInitials(message.senderName)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{message.senderName}</span>
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">- {relativeTime(message.date)}</span>
        </div>

        {/* Quoted reply */}
        {quote && (
          <div className="rounded-lg bg-muted/60 border-l-[3px] border-muted-foreground/30 p-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {quote.length > 300 ? quote.substring(0, 300) + "…" : quote}
          </div>
        )}

        {/* Body */}
        {main && (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{main}</div>
        )}

        {/* File attachments grid */}
        {message.files.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {message.files.map((file, i) => (
              <FileCard key={i} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LeadEmailThread({ metadata, notes, source }: LeadEmailThreadProps) {
  const meta = metadata as EmailMeta | null;

  const messages = useMemo<ThreadMessage[]>(() => {
    const emailFrom = meta?.email_from || parseField(notes, "From");
    const emailTo = meta?.email_to || parseField(notes, "To");
    const emailDate = meta?.email_date || parseField(notes, "Received");
    const emailBody = meta?.email_body;
    const files = meta?.files || [];

    if (!emailBody && !emailFrom) return [];

    let date = new Date();
    if (emailDate) {
      const parsed = new Date(emailDate);
      if (isValid(parsed)) date = parsed;
    }

    const senderRaw = emailFrom || "Unknown Sender";

    return [
      {
        id: "primary",
        senderName: extractName(senderRaw),
        senderEmail: extractEmail(senderRaw),
        date,
        body: emailBody || "",
        files,
      },
    ];
  }, [metadata, notes]);

  // Group messages by date
  const grouped = useMemo(() => {
    const groups: { date: string; messages: ThreadMessage[] }[] = [];
    let currentDate = "";

    for (const msg of messages) {
      const dateStr = formatDate(msg.date);
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ date: dateStr, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }

    return groups;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No email data available for this lead.
        {source && !source.startsWith("Email:") && (
          <p className="mt-1 text-xs">Source: {source}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {grouped.map((group) => (
        <div key={group.date}>
          <DateSeparator date={group.date} />
          <div className="space-y-5">
            {group.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
