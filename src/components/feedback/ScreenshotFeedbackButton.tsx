import { useState, useCallback, useRef } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const THROTTLE_MS = 3000;
const BTN_SIZE = 40;

export function ScreenshotFeedbackButton() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const cooldown = useRef(false);

  const { pos, handlers, wasDragged } = useDraggablePosition({
    storageKey: "feedback-btn-pos",
    btnSize: BTN_SIZE,
    defaultPos: () => ({
      x: typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 24 : 300,
      y: typeof window !== "undefined" ? window.innerHeight - BTN_SIZE - 96 : 300,
    }),
  });

  const btnRef = useRef<HTMLButtonElement>(null);

  const capture = useCallback(async () => {
    if (cooldown.current) return;
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, THROTTLE_MS);

    try {
      // Hide the feedback button during capture so it doesn't appear in screenshot
      if (btnRef.current) btnRef.current.style.display = "none";

      // Wait for fonts and rendering to complete
      await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Capture from document.body to include portaled elements (Sheet, Dialog, etc.)
      const target = document.body;

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(target, {
        useCORS: true,
        scale: window.devicePixelRatio || 1,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: null,
        logging: false,
        allowTaint: true,
        ignoreElements: (el) => {
          // Ignore feedback button and Vizzy floating button
          return el.getAttribute?.("data-feedback-btn") === "true" ||
            el.classList?.contains("floating-vizzy");
        },
      });
      const dataUrl = canvas.toDataURL("image/png");
      setScreenshot(dataUrl);
      setOverlayOpen(true);
    } catch (err: any) {
      console.error("Screenshot capture error:", err?.message, err?.stack);
      toast.error(`Failed to capture screen on ${window.location.pathname}`);
    } finally {
      // Always restore button visibility
      if (btnRef.current) btnRef.current.style.display = "";
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    handlers.onPointerUp(e);
    // Only trigger capture on tap, not drag
    if (!wasDragged.current) {
      capture();
    }
  }, [handlers, capture, wasDragged]);

  return (
    <>
      <button
        ref={btnRef}
        data-feedback-btn="true"
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlePointerUp}
        className="fixed z-[9999] w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform cursor-grab active:cursor-grabbing select-none"
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        aria-label="Report a change"
        title="Screenshot Feedback"
      >
        <Camera className="w-5 h-5 pointer-events-none" />
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
