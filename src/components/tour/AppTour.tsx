import Joyride from "react-joyride";
import { useTour } from "@/hooks/useTour";
import { TourTooltip } from "./TourTooltip";

export function AppTour() {
  const { run, steps, handleCallback } = useTour();

  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      spotlightClicks
      callback={handleCallback}
      tooltipComponent={TourTooltip}
      styles={{
        options: {
          arrowColor: "hsl(var(--card))",
          overlayColor: "rgba(0, 0, 0, 0.6)",
          zIndex: 10000,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
      floaterProps={{
        disableAnimation: false,
      }}
    />
  );
}
