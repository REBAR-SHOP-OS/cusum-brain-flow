import { cn } from "@/lib/utils";

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
}

interface InboxEmailListProps {
  emails: InboxEmail[];
  selectedId: string | null;
  onSelect: (email: InboxEmail) => void;
}

export function InboxEmailList({ emails, selectedId, onSelect }: InboxEmailListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {emails.map((email) => (
        <div
          key={email.id}
          onClick={() => onSelect(email)}
          className={cn(
            "p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50",
            selectedId === email.id && "bg-muted"
          )}
        >
          <div className="flex items-start gap-3">
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
                <span className="text-xs text-muted-foreground whitespace-nowrap">{email.time}</span>
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
      ))}
    </div>
  );
}
