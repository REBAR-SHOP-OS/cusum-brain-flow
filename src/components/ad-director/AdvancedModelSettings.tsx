import { useState } from "react";
import { ChevronDown, ChevronRight, Settings2, Cpu, Zap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  type ModelOverrides,
  type AITaskType,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ROUTES,
  TASK_CATEGORY_MAP,
} from "@/types/adDirector";
import { cn } from "@/lib/utils";

interface AdvancedModelSettingsProps {
  modelOverrides: ModelOverrides;
  onModelOverridesChange: (overrides: ModelOverrides) => void;
}

export function AdvancedModelSettings({ modelOverrides, onModelOverridesChange }: AdvancedModelSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const handleModelChange = (category: string, model: string) => {
    const tasks = TASK_CATEGORY_MAP[category] || [];
    const newOverrides = { ...modelOverrides };
    tasks.forEach(task => {
      if (model === "auto") {
        delete newOverrides[task];
      } else {
        newOverrides[task] = model;
      }
    });
    onModelOverridesChange(newOverrides);
  };

  const getSelectedModel = (category: string): string => {
    const tasks = TASK_CATEGORY_MAP[category] || [];
    const override = tasks.length > 0 ? modelOverrides[tasks[0]] : undefined;
    return override || "auto";
  };

  return (
    <div className="rounded-lg border border-border/30 bg-card/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5" />
          <span>AI Engine</span>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/20 pt-3">
          {/* Auto/Manual Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {manualMode ? <Cpu className="w-3.5 h-3.5 text-amber-400" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
              <Label className="text-xs">{manualMode ? "Manual Override" : "Auto Selection"}</Label>
            </div>
            <Switch checked={manualMode} onCheckedChange={setManualMode} />
          </div>

          {!manualMode && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              AI Director automatically selects the optimal model for each task based on capability, speed, and cost.
            </p>
          )}

          {/* Model Routing Table */}
          <div className="space-y-2">
            {Object.entries(DEFAULT_MODEL_ROUTES).map(([category, defaults]) => (
              <div key={category} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-foreground block">{category}</span>
                  {!manualMode && (
                    <span className="text-[9px] text-muted-foreground truncate block">
                      {AVAILABLE_MODELS.find(m => m.id === defaults.preferred)?.label || defaults.preferred}
                      {" · "}
                      <span className="text-foreground/50">{(defaults as any).provider}</span>
                    </span>
                  )}
                </div>
                {manualMode ? (
                  <Select
                    value={getSelectedModel(category)}
                    onValueChange={(v) => handleModelChange(category, v)}
                  >
                    <SelectTrigger className="h-7 w-[160px] text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto" className="text-xs">
                        Auto ({AVAILABLE_MODELS.find(m => m.id === defaults.preferred)?.label})
                      </SelectItem>
                      {AVAILABLE_MODELS.map(m => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="text-[9px] h-5">
                    {AVAILABLE_MODELS.find(m => m.id === defaults.preferred)?.label || "Auto"}
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {/* Active overrides count */}
          {Object.keys(modelOverrides).length > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border/20">
              <span className="text-[10px] text-amber-400">{Object.keys(modelOverrides).length} override(s) active</span>
              <button
                onClick={() => onModelOverridesChange({})}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Reset All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
