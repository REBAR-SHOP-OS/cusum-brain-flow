import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Mail, Clock } from "lucide-react";
import type { InboxEmail } from "./InboxEmailList";

interface InboxKanbanBoardProps {
  emails: (InboxEmail & { priority: number })[];
  onSelect: (email: InboxEmail) => void;
  selectedId: string | null;
}

const KANBAN_COLUMNS = [
  { label: "Urgent", value: "Urgent", color: "bg-red-500", dotColor: "bg-red-500" },
  { label: "To Respond", value: "To Respond", color: "bg-red-400", dotColor: "bg-red-400" },
  { label: "Awaiting Reply", value: "Awaiting Reply", color: "bg-amber-400", dotColor: "bg-amber-400" },
  { label: "FYI", value: "FYI", color: "bg-amber-400", dotColor: "bg-amber-500" },
  { label: "Notification", value: "Notification", color: "bg-cyan-400", dotColor: "bg-cyan-400" },
  { label: "Marketing", value: "Marketing", color: "bg-pink-400", dotColor: "bg-pink-400" },
  { label: "Spam", value: "Spam", color: "bg-zinc-500", dotColor: "bg-zinc-500" },
];

export function InboxKanbanBoard({ emails, onSelect, selectedId }: InboxKanbanBoardProps) {
  const emailsByLabel: Record<string, (InboxEmail & { priority: number })[]> = {};
  KANBAN_COLUMNS.forEach((col) => {
    emailsByLabel[col.value] = [];
  });
  emails.forEach((email) => {
    if (emailsByLabel[email.label]) {
      emailsByLabel[email.label].push(email);
    } else {
      // Fallback: put in "To Respond"
      emailsByLabel["To Respond"]?.push(email);
    }
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
              className="flex flex-col w-[280px] shrink-0 rounded-lg bg-muted/30 border border-border"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                <div className={cn("w-2.5 h-2.5 rounded-full", col.dotColor)} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                  {colEmails.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-280px)]">
                {colEmails.map((email) => (
                  <EmailKanbanCard
                    key={email.id}
                    email={email}
                    isSelected={selectedId === email.id}
                    onClick={() => onSelect(email)}
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

function EmailKanbanCard({
  email,
  isSelected,
  onClick,
}: {
  email: InboxEmail;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 space-y-2",
        isSelected && "ring-2 ring-primary border-primary"
      )}
    >
      {/* Sender row */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0",
            email.isUnread ? "bg-green-500" : "bg-muted-foreground/60"
          )}
        >
          {email.sender.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{email.sender}</p>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{email.time}</span>
      </div>

      {/* Subject */}
      <p className="text-xs font-medium leading-tight line-clamp-2">{email.subject}</p>

      {/* Preview */}
      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{email.preview}</p>

      {/* Footer meta */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
        <Mail className="w-3 h-3" />
        <span className="truncate">{email.senderEmail}</span>
      </div>
    </div>
  );
}
