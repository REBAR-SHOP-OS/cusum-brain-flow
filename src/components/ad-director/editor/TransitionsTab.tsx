import { ArrowRightLeft } from "lucide-react";

interface TransitionsTabProps {
  activeTransition: string;
  onSelect: (transition: string) => void;
}

const TRANSITIONS = [
  { id: "None", label: "Cut", desc: "Instant switch" },
  { id: "Crossfade", label: "Crossfade", desc: "Smooth dissolve" },
  { id: "Wipe Left", label: "Wipe", desc: "Side wipe reveal" },
  { id: "Slide Up", label: "Slide", desc: "Push slide effect" },
  { id: "Zoom In", label: "Zoom", desc: "Zoom into next" },
];

export function TransitionsTab({ activeTransition, onSelect }: TransitionsTabProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Transitions</h4>
      <div className="space-y-2">
        {TRANSITIONS.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
              activeTransition === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/30 hover:border-primary/40 hover:bg-muted/20"
            }`}
          >
            <div className="w-10 h-7 rounded bg-muted/40 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-medium">{t.label}</div>
              <div className="text-[10px] text-muted-foreground">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
