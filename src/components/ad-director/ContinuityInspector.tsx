import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { type ContinuityProfile } from "@/types/adDirector";

interface ContinuityInspectorProps {
  profile: ContinuityProfile | null;
}

const fields: { key: keyof ContinuityProfile; label: string }[] = [
  { key: "subjectDescriptions", label: "Subjects" },
  { key: "wardrobe", label: "Wardrobe / PPE" },
  { key: "environment", label: "Environment" },
  { key: "timeOfDay", label: "Time of Day" },
  { key: "cameraStyle", label: "Camera Style" },
  { key: "motionRhythm", label: "Motion Rhythm" },
  { key: "colorMood", label: "Color Mood" },
  { key: "lightingType", label: "Lighting" },
  { key: "lastFrameSummary", label: "Last Frame" },
  { key: "nextSceneBridge", label: "Bridge Note" },
];

export function ContinuityInspector({ profile }: ContinuityInspectorProps) {
  if (!profile) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold">Continuity Profile</h3>
        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Active</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
            <p className="text-[11px] text-foreground/80 leading-relaxed">{profile[key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
