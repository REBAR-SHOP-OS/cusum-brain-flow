import { cn } from "@/lib/utils";

interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QuickReplies({ replies, onSelect, disabled, className }: QuickRepliesProps) {
  if (replies.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5 mt-2", className)}>
      {replies.map((reply, i) => (
        <button
          key={i}
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
