import { Mail, User, Calendar, Paperclip } from "lucide-react";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface LeadEmailContentProps {
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
  files?: Array<{
    type: "attachment" | "link";
    filename: string;
    url?: string;
    path?: string;
    mimeType?: string;
    size?: number;
  }>;
  attachment_count?: number;
}

export function LeadEmailContent({ metadata, notes, source }: LeadEmailContentProps) {
  const meta = metadata as EmailMeta | null;

  // Fallback: parse from notes if metadata doesn't have email fields
  const emailSubject = meta?.email_subject || parseField(notes, "Subject");
  const emailFrom = meta?.email_from || parseField(notes, "From");
  const emailTo = meta?.email_to || parseField(notes, "To");
  const emailDate = meta?.email_date || parseField(notes, "Received");
  const emailBody = meta?.email_body;
  const files = meta?.files || [];

  if (!emailSubject && !emailBody && !emailFrom) {
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
    <div className="space-y-4">
      {/* Email Header */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">{emailSubject || "No subject"}</h4>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {emailFrom && (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3" />
              <span>From: <span className="text-foreground">{emailFrom}</span></span>
            </div>
          )}
          {emailTo && (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3" />
              <span>To: <span className="text-foreground">{emailTo}</span></span>
            </div>
          )}
          {emailDate && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              <span>
                {(() => {
                  try {
                    return format(new Date(emailDate), "MMM d, yyyy 'at' h:mm a");
                  } catch {
                    return emailDate;
                  }
                })()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Email Body */}
      {emailBody ? (
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Email Body</h4>
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{emailBody}</div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Email body not captured. Re-scan to populate.
          </p>
        </div>
      )}

      {/* Attachments */}
      {files.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Paperclip className="w-3 h-3" />
            Attachments ({files.length})
          </h4>
          <div className="space-y-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{file.filename}</span>
                {file.size && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parseField(notes: string | null, field: string): string | null {
  if (!notes) return null;
  const regex = new RegExp(`${field}:\\s*([^|]+)`);
  const match = notes.match(regex);
  return match ? match[1].trim() : null;
}
