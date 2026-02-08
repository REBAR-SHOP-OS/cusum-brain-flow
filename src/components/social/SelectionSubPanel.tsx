import { useState, useEffect } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectionSubPanelProps {
  title: string;
  options: SelectionOption[];
  selected: string;
  onSave: (value: string) => void;
  onBack: () => void;
}

export function SelectionSubPanel({
  title,
  options,
  selected,
  onSave,
  onBack,
}: SelectionSubPanelProps) {
const [current, setCurrent] = useState(selected);

  // keep in sync if parent changes
  useEffect(() => setCurrent(selected), [selected]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <button
          onClick={onBack}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-base font-semibold flex-1 text-center pr-6">{title}</h3>
      </div>

      {/* Options */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="rounded-lg border bg-card overflow-hidden">
          {options.map((opt, idx) => (
            <button
              key={opt.value}
              onClick={() => setCurrent(opt.value)}
              className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/50 ${
                idx < options.length - 1 ? "border-b border-border/50" : ""
              } ${current === opt.value ? "bg-muted/30" : ""}`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  current === opt.value
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}
              >
                {current === opt.value && (
                  <Check className="w-3 h-3 text-primary-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{opt.label}</p>
                {opt.description && (
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="p-4 border-t">
        <Button
          className="w-full"
          onClick={() => onSave(current)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
