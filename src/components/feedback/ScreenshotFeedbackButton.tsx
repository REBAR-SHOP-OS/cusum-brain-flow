import { useState, useCallback, useRef } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { AnnotationOverlay } from "./AnnotationOverlay";

const THROTTLE_MS = 3000;

export function ScreenshotFeedbackButton() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const cooldown = useRef(false);

  const capture = useCallback(async () => {
    if (cooldown.current) return;
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, THROTTLE_MS);

    try {
      const target = document.getElementById("main-content");
      if (!target) {
        toast.error("Cannot capture screen");
        return;
      }
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(target, { useCORS: true, scale: 1 });
      const dataUrl = canvas.toDataURL("image/png");
      setScreenshot(dataUrl);
      setOverlayOpen(true);
    } catch (err) {
      console.error("Screenshot capture error:", err);
      toast.error("Failed to capture screen");
    }
  }, []);

  return (
    <>
      <button
        onClick={capture}
        className="fixed z-[9999] bottom-24 right-6 md:bottom-6 md:right-24 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Report a change"
        title="Screenshot Feedback"
      >
        <Camera className="w-5 h-5" />
      </button>

      {overlayOpen && (
        <AnnotationOverlay
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          screenshotDataUrl={screenshot}
        />
      )}
    </>
  );
}
