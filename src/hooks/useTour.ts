import { useState, useEffect, useCallback } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { getTourSteps } from "@/components/tour/tourSteps";
import type { Step, CallBackProps } from "react-joyride";

const TOUR_STORAGE_KEY = "rsos_tour_completed";

function hasCompletedTour(userId: string): boolean {
  try {
    const data = JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || "{}");
    return !!data[userId];
  } catch {
    return false;
  }
}

function markTourCompleted(userId: string) {
  try {
    const data = JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || "{}");
    data[userId] = Date.now();
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // silently fail
  }
}

export function useTour() {
  const { user } = useAuth();
  const { roles, isLoading } = useUserRole();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  // Auto-start on first visit
  useEffect(() => {
    if (!user || isLoading) return;
    if (hasCompletedTour(user.id)) return;

    // Small delay so DOM elements mount with data-tour attributes
    const timer = setTimeout(() => {
      const tourSteps = getTourSteps(roles);
      setSteps(tourSteps);
      setRun(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [user, roles, isLoading]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status } = data;
      const finishedStatuses = ["finished", "skipped"];
      if (finishedStatuses.includes(status) && user) {
        markTourCompleted(user.id);
        setRun(false);
      }
    },
    [user]
  );

  /** Manually restart the tour */
  const restartTour = useCallback(() => {
    const tourSteps = getTourSteps(roles);
    setSteps(tourSteps);
    setRun(true);
  }, [roles]);

  /** Reset stored completion (for testing) */
  const resetTour = useCallback(() => {
    if (user) {
      try {
        const data = JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || "{}");
        delete data[user.id];
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // silently fail
      }
    }
  }, [user]);

  return { run, steps, handleCallback, restartTour, resetTour };
}
