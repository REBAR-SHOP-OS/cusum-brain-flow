import { ChevronLeft, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

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
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/integrations")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Daily Summarizer</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onPreviousDay}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium min-w-[120px] text-center">
          {format(currentDate, "MMM d, yyyy")}
        </span>
        <Button variant="ghost" size="icon" onClick={onNextDay}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
