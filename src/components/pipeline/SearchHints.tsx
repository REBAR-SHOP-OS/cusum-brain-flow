import { useRef, useEffect } from "react";
import { SEARCH_HINTS } from "@/lib/smartSearchParser";
import { Calendar, TrendingUp, Layers, DollarSign, Clock } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Date: <Calendar className="w-3 h-3" />,
  Status: <TrendingUp className="w-3 h-3" />,
  Stage: <Layers className="w-3 h-3" />,
  Revenue: <DollarSign className="w-3 h-3" />,
  Activity: <Clock className="w-3 h-3" />,
};

interface SearchHintsProps {
  visible: boolean;
  inputValue: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

export function SearchHints({ visible, inputValue, onSelect, onClose }: SearchHintsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [visible, onClose]);

  if (!visible) return null;

  const q = inputValue.toLowerCase().trim();

  // Filter suggestions based on current input
  const filtered = SEARCH_HINTS.map((cat) => ({
    ...cat,
    suggestions: cat.suggestions.filter((s) =>
      !q || s.toLowerCase().includes(q)
    ),
  })).filter((cat) => cat.suggestions.length > 0);

  if (filtered.length === 0 && q.length > 0) return null;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
    >
      <div className="px-3 py-1.5 border-b border-border">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Smart search — type naturally
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-border max-h-60 overflow-y-auto">
        {filtered.map((cat) => (
          <div key={cat.category} className="p-2 space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 px-1.5 pb-0.5">
              {CATEGORY_ICONS[cat.category]}
              {cat.category}
            </p>
            {cat.suggestions.map((s) => (
              <button
                key={s}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(s);
                }}
                className="block w-full text-left px-1.5 py-1 rounded text-xs hover:bg-accent text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
