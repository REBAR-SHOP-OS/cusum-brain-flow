import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Mail, Phone, MessageSquare } from "lucide-react";
import type { InboxEmail } from "./InboxEmailList";

interface InboxKanbanBoardProps {
  emails: (InboxEmail & { priority: number; commType?: "email" | "call" | "sms" | "voicemail" | "fax" })[];
  onSelect: (email: InboxEmail) => void;
  selectedId: string | null;
  starredIds?: Set<string>;
  onToggleStar?: (id: string) => void;
}

const KANBAN_COLUMNS = [
  { label: "Urgent", value: "Urgent", dotColor: "bg-red-500" },
  { label: "To Respond", value: "To Respond", dotColor: "bg-red-400" },
  { label: "Awaiting Reply", value: "Awaiting Reply", dotColor: "bg-amber-400" },
  { label: "FYI", value: "FYI", dotColor: "bg-amber-500" },
  { label: "Notification", value: "Notification", dotColor: "bg-cyan-400" },
  { label: "Marketing", value: "Marketing", dotColor: "bg-pink-400" },
  { label: "Spam", value: "Spam", dotColor: "bg-zinc-500" },
];

function getTypeBadge(type?: "email" | "call" | "sms" | "voicemail" | "fax") {
  switch (type) {
    case "call":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400">
          <Phone className="w-2.5 h-2.5" /> Call
        </span>
      );
    case "sms":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-500/15 text-green-400">
          <MessageSquare className="w-2.5 h-2.5" /> SMS
        </span>
      );
    default:
      return null;
  }
}

function getTypeIcon(type?: "email" | "call" | "sms" | "voicemail" | "fax") {
  switch (type) {
    case "call":
      return <Phone className="w-3 h-3 text-blue-400" />;
    case "sms":
      return <MessageSquare className="w-3 h-3 text-green-400" />;
    default:
      return <Mail className="w-3 h-3 text-muted-foreground" />;
  }
}

export function InboxKanbanBoard({ emails, onSelect, selectedId, starredIds = new Set(), onToggleStar }: InboxKanbanBoardProps) {
  const emailsByLabel: Record<string, (InboxEmail & { priority: number; commType?: "email" | "call" | "sms" | "voicemail" | "fax" })[]> = {};
  KANBAN_COLUMNS.forEach((col) => {
    emailsByLabel[col.value] = [];
  });
  emails.forEach((email) => {
    if (emailsByLabel[email.label]) {
      emailsByLabel[email.label].push(email);
    } else {
      emailsByLabel["To Respond"]?.push(email);
    }
  });

  // Sort each column newest-first
  KANBAN_COLUMNS.forEach((col) => {
    emailsByLabel[col.value].sort((a, b) => {
      const ta = a.fullDate ? new Date(a.fullDate).getTime() : 0;
      const tb = b.fullDate ? new Date(b.fullDate).getTime() : 0;
      return tb - ta;
    });
  });

  return (
    <ScrollArea className="flex-1 w-full">
      <div className="flex gap-3 p-4 min-w-max h-full">
        {KANBAN_COLUMNS.map((col) => {
          const colEmails = emailsByLabel[col.value] || [];
          if (colEmails.length === 0) return null;

          return (
            <div
              key={col.value}
              className="flex flex-col w-[280px] shrink-0 rounded-xl bg-muted/20 border border-border/50"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
                <div className={cn("w-2.5 h-2.5 rounded-full", col.dotColor)} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5 rounded-full">
                  {colEmails.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-280px)]">
                {colEmails.map((email) => (
                  <KanbanCard
                    key={email.id}
                    email={email}
                    isSelected={selectedId === email.id}
                    onClick={() => onSelect(email)}
                    isStarred={starredIds.has(email.id)}
                    onToggleStar={onToggleStar ? () => onToggleStar(email.id) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function KanbanCard({
  email,
  isSelected,
  onClick,
  isStarred,
  onToggleStar,
}: {
  email: InboxEmail & { commType?: "email" | "call" | "sms" | "voicemail" | "fax" };
  isSelected: boolean;
  onClick: () => void;
  isStarred?: boolean;
  onToggleStar?: () => void;
}) {
  const isCall = email.commType === "call";
  const isSms = email.commType === "sms";

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border/60 bg-card p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 space-y-2",
        isSelected && "ring-2 ring-primary border-primary"
      )}
    >
      {/* Sender row */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0",
            isCall ? "bg-blue-500" : isSms ? "bg-green-500" : email.isUnread ? "bg-emerald-500" : "bg-muted-foreground/60"
          )}
        >
          {isCall ? (
            <Phone className="w-3.5 h-3.5" />
          ) : isSms ? (
            <MessageSquare className="w-3.5 h-3.5" />
          ) : (
            email.sender.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{email.sender}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleStar && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
              className="p-0.5 hover:scale-110 transition-transform"
            >
              <Star className={cn("w-3 h-3", isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
            </button>
          )}
          {getTypeBadge(email.commType)}
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{email.time}</span>
        </div>
      </div>

      {/* Subject */}
      <p className="text-xs font-medium leading-tight line-clamp-2">{email.subject}</p>

      {/* Preview */}
      {email.preview && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{email.preview}</p>
      )}

      {/* Footer meta */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
        {getTypeIcon(email.commType)}
        <span className="truncate">{email.senderEmail}</span>
      </div>
    </div>
  );
}
