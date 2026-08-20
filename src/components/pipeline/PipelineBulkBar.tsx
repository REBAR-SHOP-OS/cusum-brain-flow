import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ArrowRight, X, UserPlus } from "lucide-react";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import { motion, AnimatePresence } from "framer-motion";

interface PipelineBulkBarProps {
  count: number;
  onMove: (stage: string) => void;
  onDelete: () => void;
  onClear: () => void;
  isMoving: boolean;
  isDeleting: boolean;
}

export function PipelineBulkBar({ count, onMove, onDelete, onClear, isMoving, isDeleting }: PipelineBulkBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-popover border border-border shadow-lg rounded-lg px-4 py-2.5"
        >
          <span className="text-sm font-medium text-foreground">
            {count} selected
          </span>

          <Select onValueChange={onMove} disabled={isMoving}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Move to stage..." />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={onClear}
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
