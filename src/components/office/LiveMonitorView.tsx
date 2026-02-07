import { Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function LiveMonitorView() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Activity className="w-7 h-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-black italic text-foreground uppercase">Live Monitor</h1>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Real-time machine status dashboard. View active runs, operator assignments, and production metrics.
      </p>
      <Link to="/shopfloor/live-monitor">
        <Button variant="outline" className="mt-2">
          Open Full Live Monitor
        </Button>
      </Link>
    </div>
  );
}
