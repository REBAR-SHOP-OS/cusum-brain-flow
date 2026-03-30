import { useState, useEffect } from "react";
import { ChevronLeft, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectionGroup {
  label: string;
  options: SelectionOption[];
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
  groups?: never;
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
  groups?: SelectionGroup[];
}

type SelectionSubPanelProps = SingleSelectProps | MultiSelectProps;

export function SelectionSubPanel(props: SelectionSubPanelProps) {
  const { title, options, onBack } = props;
  const isMulti = props.multiSelect === true;
  const groups = isMulti ? props.groups : undefined;

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

  const allSelected = isMulti && currentMulti.length === options.length;

  const toggleAll = () => {
    if (allSelected) {
      setCurrentMulti([]);
    } else {
      setCurrentMulti(options.map((o) => o.value));
    }
  };

  const renderOption = (opt: SelectionOption, isLast: boolean) => {
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
          !isLast ? "border-b border-border/50" : ""
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
  };

  const renderGrouped = () => {
    if (!groups || groups.length === 0) return renderFlat();

    return (
      <div className="space-y-3">
        {groups.map((group) => {
          const groupValues = group.options.map((o) => o.value);
          const allGroupSelected = groupValues.length > 0 && groupValues.every((v) => currentMulti.includes(v));

          const toggleGroup = () => {
            if (allGroupSelected) {
              setCurrentMulti((prev) => prev.filter((v) => !groupValues.includes(v)));
            } else {
              setCurrentMulti((prev) => [...new Set([...prev, ...groupValues])]);
            }
          };

          return (
            <div key={group.label} className="rounded-lg border bg-card overflow-hidden">
              <div className="px-3.5 py-2.5 bg-muted/60 border-b flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <button
                  onClick={toggleGroup}
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                    allGroupSelected ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{allGroupSelected ? "Deselect" : "Select All"}</span>
                </button>
              </div>
              {group.options.map((opt, idx) =>
                renderOption(opt, idx === group.options.length - 1)
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFlat = () => (
    <div className="rounded-lg border bg-card overflow-hidden">
      {options.map((opt, idx) =>
        renderOption(opt, idx === options.length - 1)
      )}
    </div>
  );

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
        <h3 className="text-base font-semibold flex-1 text-center">{title}</h3>
      </div>

      {/* Options */}
      <div className="flex-1 overflow-y-auto p-4">
        {isMulti && (
          <button
            onClick={toggleAll}
            className={`flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              allSelected ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={allSelected ? "Deselect all" : "Select all"}
          >
            <CheckCheck className="w-4 h-4" />
            <span>{allSelected ? "Deselect All" : "Select All"}</span>
          </button>
        )}
        {groups && groups.length > 0 ? renderGrouped() : renderFlat()}
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
