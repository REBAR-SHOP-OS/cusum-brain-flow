import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const emojiCategories = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥"],
  },
  {
    name: "Gestures",
    emojis: ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤝", "👏", "🙌", "👐", "🤲", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "💪", "🦾", "🙏"],
  },
  {
    name: "Objects",
    emojis: ["💼", "📁", "📂", "📊", "📈", "📉", "📋", "📌", "📎", "🔗", "📧", "✉️", "📦", "🏷️", "💰", "💵", "💳", "🧾", "📅", "⏰", "🔔", "🔒", "🔑", "🛠️", "⚙️", "📱"],
  },
  {
    name: "Symbols",
    emojis: ["✅", "❌", "⚠️", "❗", "❓", "💡", "🔥", "⭐", "🎯", "🏆", "🚀", "💎", "🔄", "➕", "➖", "✖️", "➗", "▶️", "⏸️", "⏹️", "🔴", "🟢", "🔵", "🟡", "⚫", "⚪"],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className={cn(
              "p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50",
              disabled && "opacity-50 cursor-not-allowed",
              isOpen && "text-foreground bg-muted/50"
            )}
          >
            <Smile className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Emoji</TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-[320px] bg-popover border border-border rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Category tabs */}
          <div className="flex gap-1 p-2 border-b border-border">
            {emojiCategories.map((cat, i) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(i)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md transition-colors font-medium",
                  i === activeCategory
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="p-2 max-h-[200px] overflow-y-auto scrollbar-thin">
            <div className="grid grid-cols-8 gap-0.5">
              {emojiCategories[activeCategory].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    setIsOpen(false);
                  }}
                  className="w-9 h-9 flex items-center justify-center text-lg rounded-md hover:bg-muted/70 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
