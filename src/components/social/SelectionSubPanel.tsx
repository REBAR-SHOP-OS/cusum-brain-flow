import { useState, useEffect } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
}

interface SingleSelectProps {
  title: string;
  options: SelectionOption[];
  selected: string;
  onSave: (value: string) => void;
  onBack: () => void;
  multiSelect?: false;
  selectedMulti?: never;
  onSaveMulti?: never;
}

interface MultiSelectProps {
  title: string;
  options: SelectionOption[];
  multiSelect: true;
  selectedMulti: string[];
  onSaveMulti: (values: string[]) => void;
  onBack: () => void;
  selected?: never;
  onSave?: never;
}

type SelectionSubPanelProps = SingleSelectProps | MultiSelectProps;

export function SelectionSubPanel(props: SelectionSubPanelProps) {
  const { title, options, onBack } = props;
  const isMulti = props.multiSelect === true;

  const [current, setCurrent] = useState(isMulti ? "" : (props.selected ?? ""));
  const [currentMulti, setCurrentMulti] = useState<string[]>(
    isMulti ? props.selectedMulti : []
  );

  useEffect(() => {
    if (!isMulti) setCurrent(props.selected ?? "");
  }, [isMulti, props.selected]);

  useEffect(() => {
    if (isMulti) setCurrentMulti(props.selectedMulti ?? []);
  }, [isMulti, props.selectedMulti]);

  const toggleMulti = (value: string) => {
    setCurrentMulti((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = () => {
    if (isMulti) {
      props.onSaveMulti(currentMulti);
    } else {
      props.onSave(current);
    }
  };

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
          {options.map((opt, idx) => {
            const isSelected = isMulti
              ? currentMulti.includes(opt.value)
              : current === opt.value;

            return (
              <button
                key={opt.value}
                onClick={() =>
                  isMulti ? toggleMulti(opt.value) : setCurrent(opt.value)
                }
                className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/50 ${
                  idx < options.length - 1 ? "border-b border-border/50" : ""
                } ${isSelected ? "bg-muted/30" : ""}`}
              >
                {isMulti ? (
                  <div
                    className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                ) : (
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{opt.label}</p>
                  {opt.description && (
                    <p className="text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="p-4 border-t">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={isMulti && currentMulti.length === 0}
        >
          Save{isMulti && currentMulti.length > 0 ? ` (${currentMulti.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
