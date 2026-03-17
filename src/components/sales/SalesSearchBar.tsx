import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useRef, useEffect } from "react";

interface SalesSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocusKey?: string; // keyboard shortcut key that triggers focus
}

export default function SalesSearchBar({ value, onChange, placeholder = "Search...", autoFocusKey = "/" }: SalesSearchBarProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === autoFocusKey && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape") ref.current?.blur();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [autoFocusKey]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8 h-8 text-xs bg-muted/30 border-border/50"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
