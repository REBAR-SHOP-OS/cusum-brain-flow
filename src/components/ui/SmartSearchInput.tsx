import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Calendar, Tag, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseGenericSearch,
  type GenericSearchConfig,
  type GenericSearchResult,
} from "@/lib/genericSearchParser";

export interface SmartSearchHint {
  category: string;
  suggestions: string[];
}

interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onParsedChange?: (result: GenericSearchResult) => void;
  placeholder?: string;
  hints?: SmartSearchHint[];
  config?: GenericSearchConfig;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Date: <Calendar className="w-3 h-3" />,
  Status: <Tag className="w-3 h-3" />,
  Activity: <Clock className="w-3 h-3" />,
};

export function SmartSearchInput({
  value,
  onChange,
  onParsedChange,
  placeholder = "Search...",
  hints = [],
  config,
  className,
}: SmartSearchInputProps) {
  const [showHints, setShowHints] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Parse on every value change
  useEffect(() => {
    if (config && onParsedChange) {
      const result = parseGenericSearch(value, config);
      onParsedChange(result);
    }
  }, [value, config, onParsedChange]);

  // Close hints on outside click
  useEffect(() => {
    if (!showHints) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowHints(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHints]);

  const handleHintSelect = useCallback(
    (suggestion: string) => {
      const current = value.trim();
      const newVal = current ? `${current} ${suggestion}` : suggestion;
      onChange(newVal);
      setShowHints(false);
    },
    [value, onChange]
  );

  const q = value.toLowerCase().trim();
  const filtered = hints
    .map((cat) => ({
      ...cat,
      suggestions: cat.suggestions.filter(
        (s) => !q || s.toLowerCase().includes(q)
      ),
    }))
    .filter((cat) => cat.suggestions.length > 0);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/60" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowHints(true)}
        className="w-full bg-secondary border border-border rounded-md text-sm pl-9 pr-8 h-9 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Hint dropdown */}
      {showHints && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Smart search — type naturally
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-border max-h-48 overflow-y-auto">
            {filtered.map((cat) => (
              <div key={cat.category} className="p-2 space-y-0.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 px-1.5 pb-0.5">
                  {CATEGORY_ICONS[cat.category] || <Tag className="w-3 h-3" />}
                  {cat.category}
                </p>
                {cat.suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleHintSelect(s);
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
      )}
    </div>
  );
}
