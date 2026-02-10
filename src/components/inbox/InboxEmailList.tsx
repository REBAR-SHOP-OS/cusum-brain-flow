import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { SwipeableEmailItem } from "./SwipeableEmailItem";

export interface InboxEmail {
  id: string;
  sender: string;
  senderEmail: string;
  toAddress: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  fullDate: string;
  label: string;
  labelColor: string;
  isUnread?: boolean;
  threadId?: string;
  sourceId?: string;
}

interface InboxEmailListProps {
  emails: InboxEmail[];
  selectedId: string | null;
  onSelect: (email: InboxEmail) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  starredIds?: Set<string>;
  onToggleStar?: (id: string) => void;
}

export function InboxEmailList({
  emails,
  selectedId,
  onSelect,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onDelete,
  onArchive,
  starredIds = new Set(),
  onToggleStar,
}: InboxEmailListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {emails.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          No emails found
        </div>
      )}
      {emails.map((email) => (
        <SwipeableEmailItem
          key={email.id}
          onDelete={() => onDelete?.(email.id)}
          onArchive={() => onArchive?.(email.id)}
          disabled={selectionMode}
        >
          <div
            onClick={() => {
              if (selectionMode) {
                onToggleSelect?.(email.id);
              } else {
                onSelect(email);
              }
            }}
            className={cn(
              "p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50",
              selectedId === email.id && "bg-muted",
              selectionMode && selectedIds.has(email.id) && "bg-primary/10"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox in selection mode */}
              {selectionMode && (
                <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(email.id)}
                    onCheckedChange={() => onToggleSelect?.(email.id)}
                  />
                </div>
              )}

              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0",
                email.isUnread ? "bg-green-500" : "bg-gray-400"
              )}>
                {email.sender.charAt(0)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium truncate">{email.sender}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Star icon */}
                    {onToggleStar && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(email.id);
                        }}
                        className="p-0.5 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            starredIds.has(email.id)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/40 hover:text-muted-foreground"
                          )}
                        />
                      </button>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{email.time}</span>
                  </div>
                </div>
                <p className="text-sm font-medium mb-1 truncate">{email.subject}</p>
                <p className="text-sm text-muted-foreground truncate">{email.preview}</p>

                {/* Label */}
                <span className={cn(
                  "inline-block mt-2 px-2 py-0.5 rounded text-xs text-white",
                  email.labelColor
                )}>
                  {email.label}
                </span>
              </div>
            </div>
          </div>
        </SwipeableEmailItem>
      ))}
    </div>
  );
}
