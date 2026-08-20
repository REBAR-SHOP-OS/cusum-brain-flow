import { useMemo } from "react";
import { AlertTriangle, Clock, Pause } from "lucide-react";
import type { LiveMachine } from "@/types/machine";

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface DowntimeAlertBannerProps {
  machines: LiveMachine[];
}

function minutesSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 60_000);
}

export function DowntimeAlertBanner({ machines }: DowntimeAlertBannerProps) {
  const downMachines = useMemo(
    () => machines.filter((m) => m.status === "down"),
    [machines]
  );

  const idleMachines = useMemo(
    () =>
      machines.filter(
        (m) => m.status === "idle" && minutesSince(m.last_event_at) > 30
      ),
    [machines]
  );

  if (downMachines.length === 0 && idleMachines.length === 0) return null;

  return (
    <div className="space-y-2">
      {downMachines.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30"
        >
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-sm font-bold text-destructive">
            {m.name} is DOWN
          </span>
          {m.last_event_at && (
            <span className="text-xs text-destructive/70 ml-auto">
              {minutesSince(m.last_event_at)} min ago
            </span>
          )}
        </div>
      ))}
      {idleMachines.map((m) => {
        const mins = minutesSince(m.last_event_at);
        const isPaused = mins > 5;
        return (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/30"
          >
            {isPaused ? (
              <Pause className="w-4 h-4 text-warning shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-warning shrink-0" />
            )}
            <span className="text-sm font-bold text-warning">
              {isPaused
                ? `${m.name} idle – paused since ${formatTime(m.last_event_at!)}`
                : `${m.name} idle for ${mins}+ min`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
