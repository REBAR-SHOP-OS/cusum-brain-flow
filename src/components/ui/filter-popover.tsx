import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── FilterToggle ──

export function FilterToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "hover:bg-accent text-foreground"
      )}
    >
      {active && <Check className="w-3 h-3" />}
      <span className={cn(!active && "pl-5")}>{label}</span>
    </button>
  );
}

// ── FilterChip ──

export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Badge
      variant="secondary"
      className="shrink-0 gap-1 h-6 text-[11px] cursor-pointer hover:bg-destructive/10 group pr-1"
    >
      {label}
      <X
        className="w-3 h-3 text-muted-foreground group-hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </Badge>
  );
}

// ── FieldFilter ──

export function FieldFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors",
          value
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-accent text-foreground"
        )}
      >
        {value && <Check className="w-3 h-3" />}
        <span className={cn(!value && "pl-5", "flex-1 text-left truncate")}>
          {value || label}
        </span>
        <ChevronDown
          className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="ml-5 mt-0.5 space-y-0.5 max-h-40 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(value === opt ? null : opt);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-colors",
                value === opt
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent"
              )}
            >
              {value === opt && <Check className="w-2.5 h-2.5" />}
              <span className={cn(value !== opt && "pl-4", "truncate")}>
                {opt}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DateFilterDropdown ──

const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "this_quarter", label: "This Quarter" },
  { id: "this_year", label: "This Year" },
  { id: "last_7", label: "Last 7 Days" },
  { id: "last_30", label: "Last 30 Days" },
  { id: "last_365", label: "Last 365 Days" },
];

export { DATE_RANGES };

export function DateFilterDropdown({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors",
          value
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-accent text-foreground"
        )}
      >
        {value && <Check className="w-3 h-3" />}
        <span className={cn(!value && "pl-5", "flex-1 text-left")}>
          {label}
        </span>
        <ChevronDown
          className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="ml-5 mt-0.5 space-y-0.5">
          {DATE_RANGES.map((dr) => (
            <button
              key={dr.id}
              onClick={() => {
                onChange(value === dr.id ? null : dr.id);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-colors",
                value === dr.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent"
              )}
            >
              {value === dr.id && <Check className="w-2.5 h-2.5" />}
              <span className={cn(value !== dr.id && "pl-4")}>
                {dr.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
