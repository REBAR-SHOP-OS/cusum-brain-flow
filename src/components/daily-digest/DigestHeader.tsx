import { ChevronLeft, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface DigestHeaderProps {
  currentDate: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export function DigestHeader({ currentDate, onPreviousDay, onNextDay, onRefresh, loading }: DigestHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/integrations")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Daily Digest</h1>
          {isToday(currentDate) && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">Today</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <div className="flex items-center bg-muted/50 rounded-lg px-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPreviousDay}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-medium min-w-[100px] text-center tabular-nums">
            {format(currentDate, "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextDay}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
