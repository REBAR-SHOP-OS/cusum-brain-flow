import { useState, useCallback, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const THROTTLE_MS = 3000;
const BTN_SIZE = 40;

export function ScreenshotFeedbackButton() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const [capturing, setCapturing] = useState(false);
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
    if (cooldown.current || capturing) return;
    cooldown.current = true;
    setCapturing(true);
    setTimeout(() => { cooldown.current = false; }, THROTTLE_MS);

    const hasOverlay = document.querySelector(
      '[data-radix-dialog-overlay], [role="dialog"], [data-state="open"][data-radix-dialog-content], [vaul-drawer]'
    );
    const target = hasOverlay ? document.body : (document.getElementById("main-content") || document.body);
    const rect = hasOverlay
      ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
      : target.getBoundingClientRect();

    const baseOpts = {
      useCORS: true,
      allowTaint: false,
      scale: 1,
      width: rect.width,
      height: rect.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: rect.left,
      y: rect.top,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: getComputedStyle(document.documentElement).backgroundColor || "#0f172a",
      logging: false,
      ignoreElements: (el: Element) => {
        return el.getAttribute?.("data-feedback-btn") === "true" ||
          el.classList?.contains("floating-vizzy");
      },
      onclone: (clonedDoc: Document) => {
        const style = clonedDoc.createElement("style");
        style.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }";
        clonedDoc.head.appendChild(style);
      },
    };

    const hiddenEls: HTMLElement[] = [];

    // Fast element count to determine strategy
    const totalCount = target.querySelectorAll("*").length;
    const isHeavyPage = totalCount > 3000;

    // Lightweight trimming: only target known scroll containers, not every DOM node
    const trimStart = performance.now();
    try {
      const scrollSelectors = '[data-radix-scroll-area-viewport], [class*="overflow-y-auto"], [class*="overflow-auto"], tbody, [class*="kanban"], [role="list"]';
      const scrollContainers = target.querySelectorAll(scrollSelectors);

      scrollContainers.forEach((container) => {
        // Abort if trimming is taking too long (500ms budget)
        if (performance.now() - trimStart > 500) return;

        const cRect = container.getBoundingClientRect();
        // Only process direct children to avoid deep traversal
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement;
          const childRect = child.getBoundingClientRect();
          if (childRect.bottom < cRect.top - 50 || childRect.top > cRect.bottom + 50) {
            child.style.visibility = "hidden";
            hiddenEls.push(child);
          }
        }
      });
    } catch {
      // Trimming failed — proceed without it
    }

    const captureOnce = (skipImages: boolean): Promise<HTMLCanvasElement> => {
      const opts = {
        ...baseOpts,
        scale: isHeavyPage ? 0.4 : 1,
        imageTimeout: isHeavyPage ? 0 : 5000,
      };
      return Promise.race([
        html2canvas(target, opts),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("screenshot_timeout")), isHeavyPage ? 3000 : 5000)),
      ]);
    };

    try {
      await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      let dataUrl: string;
      try {
        const canvas = await captureOnce(false);
        dataUrl = canvas.toDataURL("image/png");
        if (dataUrl.length < 1000) throw new Error("blank_canvas");
      } catch (firstErr) {
        console.warn("Screenshot attempt 1 failed, retrying without images:", firstErr);
        const canvas = await captureOnce(true);
        dataUrl = canvas.toDataURL("image/png");
        if (dataUrl.length < 1000) throw new Error("blank_canvas_after_retry");
      }

      setScreenshot(dataUrl);
      setOverlayOpen(true);
    } catch (err: any) {
      console.error("Screenshot failed after retry:", err?.message, err?.stack, {
        path: window.location.pathname,
        domElements: document.body.querySelectorAll("*").length,
      });
      toast.error(`Failed to capture screen on ${window.location.pathname}`);
    } finally {
      // Restore hidden elements immediately
      hiddenEls.forEach(el => el.style.visibility = "");
      setCapturing(false);
    }
  }, [capturing]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    handlers.onPointerUp(e);
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
        style={{ left: pos.x, top: pos.y, touchAction: "none", pointerEvents: "auto" }}
        aria-label="Report a change"
        title="Screenshot Feedback"
      >
        {capturing ? (
          <Loader2 className="w-5 h-5 pointer-events-none animate-spin" />
        ) : (
          <Camera className="w-5 h-5 pointer-events-none" />
        )}
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
