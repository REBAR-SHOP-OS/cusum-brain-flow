import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Upload, ScanEye, Brain, Calculator } from "lucide-react";
import { motion } from "framer-motion";

const stages = [
  { key: "uploading", label: "Uploading Files", icon: Upload },
  { key: "ocr", label: "Running OCR", icon: ScanEye },
  { key: "extraction", label: "AI Extraction", icon: Brain },
  { key: "calculation", label: "Calculating", icon: Calculator },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
];

const progressMap: Record<string, number> = {
  uploading: 15,
  ocr: 35,
  extraction: 60,
  calculation: 80,
  complete: 100,
};

interface TakeoffPipelineProps {
  stage: string | null;
}

export default function TakeoffPipeline({ stage }: TakeoffPipelineProps) {
  if (!stage) return null;

  const currentIdx = stages.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-4 py-4">
      <Progress value={progressMap[stage] ?? 0} className="h-2" />
      <div className="flex items-center justify-between">
        {stages.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          return (
            <motion.div
              key={s.key}
              className="flex flex-col items-center gap-1"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: isDone || isActive ? 1 : 0.4 }}
            >
              <div
                className={`rounded-full p-2 ${
                  isDone
                    ? "bg-green-500/15 text-green-600"
                    : isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "animate-pulse" : ""}`} />
              </div>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
