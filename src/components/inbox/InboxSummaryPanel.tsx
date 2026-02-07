import { X, FileText, AlertTriangle, CheckCircle, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface InboxSummary {
  totalEmails: number;
  toRespond: number;
  fyi: number;
  marketing: number;
  spam: number;
  highlights: string[];
}

interface InboxSummaryPanelProps {
  summary: InboxSummary | null;
  onClose: () => void;
}

export function InboxSummaryPanel({ summary, onClose }: InboxSummaryPanelProps) {
  if (!summary) return null;

  return (
    <div className="border-b bg-primary/5 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">AI Inbox Summary</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs">
            <strong>{summary.toRespond}</strong> Need Reply
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-warning" />
          <span className="text-xs">
            <strong>{summary.fyi}</strong> FYI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs">
            <strong>{summary.marketing}</strong> Marketing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-success" />
          <span className="text-xs">
            <strong>{summary.totalEmails}</strong> Total
          </span>
        </div>
      </div>

      {summary.spam > 0 && (
        <Badge variant="destructive" className="text-xs mb-2">
          {summary.spam} potential spam detected
        </Badge>
      )}

      {summary.highlights.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Key highlights:</p>
          <ul className="space-y-0.5">
            {summary.highlights.map((h, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
