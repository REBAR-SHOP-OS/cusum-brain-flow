import { useState, useCallback, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { AnnotationOverlay, SpeechControls } from "./AnnotationOverlay";
import { FloatingMicButton } from "./FloatingMicButton";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const THROTTLE_MS = 3000;
const BTN_SIZE = 40;

export function ScreenshotFeedbackButton() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [initialDescription, setInitialDescription] = useState("");
  const cooldown = useRef(false);
  const speechControlRef = useRef<SpeechControls | null>(null);
  const [speechState, setSpeechState] = useState({ isListening: false, isSupported: true });

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
    const isOverlay = !!hasOverlay;

    // --- Pre-capture: temporarily expand overflow-hidden containers ---
    const expandedEls: { el: HTMLElement; orig: string }[] = [];
    const expand = (el: HTMLElement, css: string) => {
      expandedEls.push({ el, orig: el.style.cssText });
      el.style.cssText += css;
    };

    if (!isOverlay && target instanceof HTMLElement) {
      expand(target, "; overflow: visible !important; height: auto !important;");
      target.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-x-scroll')
        .forEach(el => expand(el, "; overflow: visible !important; height: auto !important;"));
      target.querySelectorAll<HTMLElement>('[data-radix-scroll-area-viewport], .overflow-y-auto, .overflow-y-scroll, .overflow-auto')
        .forEach(el => expand(el, "; overflow: visible !important; max-height: none !important; height: auto !important;"));

      // Walk up ancestors to remove clipping
      let parent = target.parentElement;
      while (parent && parent !== document.body) {
        const cs = getComputedStyle(parent);
        if (cs.overflow !== "visible" || cs.overflowY !== "visible" || cs.overflowX !== "visible") {
          expand(parent, "; overflow: visible !important; max-height: none !important; height: auto !important;");
        }
        parent = parent.parentElement;
      }
    }

    const captureWidth  = isOverlay ? window.innerWidth  : target.scrollWidth;
    const captureHeight = isOverlay ? window.innerHeight : target.scrollHeight;
    const targetRect    = isOverlay ? null : target.getBoundingClientRect();
    const captureX = 0;
    const captureY = 0;

    const baseIgnore = (el: Element) => {
      const tag = el.tagName?.toLowerCase();
      if (tag === "iframe" || tag === "embed" || tag === "object") return true;
      if (el.getAttribute?.("data-feedback-btn") === "true") return true;
      if (el.classList?.contains("floating-vizzy")) return true;
      return false;
    };

    const baseOpts = {
      useCORS: true,
      allowTaint: false,
      scale: 1,
      width: captureWidth,
      height: captureHeight,
      windowWidth: Math.max(window.innerWidth, captureWidth),
      windowHeight: Math.max(window.innerHeight, captureHeight),
      x: captureX,
      y: captureY,
      scrollX: isOverlay ? 0 : -target.scrollLeft,
      scrollY: isOverlay ? 0 : -target.scrollTop,
      backgroundColor: getComputedStyle(document.documentElement).backgroundColor || "#0f172a",
      logging: false,
      ignoreElements: baseIgnore,
      onclone: (clonedDoc: Document) => {
        try {
          const style = clonedDoc.createElement("style");
          style.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }";
          clonedDoc.head.appendChild(style);
        } catch {}
        clonedDoc.querySelectorAll("iframe, embed, object").forEach((el) => {
          try {
            const placeholder = clonedDoc.createElement("div");
            placeholder.style.cssText = `width:${(el as HTMLElement).offsetWidth}px;height:${(el as HTMLElement).offsetHeight}px;background:#1e293b;`;
            el.parentNode?.replaceChild(placeholder, el);
          } catch {}
        });
      },
    };

    const totalCount = target.querySelectorAll("*").length;
    const isHeavyPage = totalCount > 3000;

    const captureOnce = (skipImages: boolean): Promise<HTMLCanvasElement> => {
      const ignoreElements = skipImages
        ? (el: Element) => {
            if (baseIgnore(el)) return true;
            const tag = el.tagName?.toLowerCase();
            return tag === "img" || tag === "video" || tag === "picture" || tag === "source" || tag === "svg" || tag === "canvas";
          }
        : baseIgnore;

      const onclone = (clonedDoc: Document) => {
        try {
          const style = clonedDoc.createElement("style");
          style.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }";
          clonedDoc.head.appendChild(style);
        } catch {}
        clonedDoc.querySelectorAll("iframe, embed, object").forEach((el) => {
          try {
            const placeholder = clonedDoc.createElement("div");
            placeholder.style.cssText = `width:${(el as HTMLElement).offsetWidth}px;height:${(el as HTMLElement).offsetHeight}px;background:#1e293b;`;
            el.parentNode?.replaceChild(placeholder, el);
          } catch {}
        });
        if (skipImages) {
          clonedDoc.querySelectorAll("img, video, picture, svg, canvas").forEach((el) => {
            try {
              const placeholder = clonedDoc.createElement("div");
              placeholder.style.cssText = `width:${(el as HTMLElement).offsetWidth || 0}px;height:${(el as HTMLElement).offsetHeight || 0}px;background:#334155;`;
              el.parentNode?.replaceChild(placeholder, el);
            } catch {}
          });
        }
      };

      const opts = {
        ...baseOpts,
        scale: isHeavyPage ? 0.75 : 1,
        imageTimeout: skipImages ? 0 : (isHeavyPage ? 0 : 5000),
        ignoreElements,
        onclone,
      };
      return Promise.race([
        html2canvas(target, opts),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("screenshot_timeout")), isHeavyPage ? 12000 : 15000)),
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
      expandedEls.forEach(({ el, orig }) => { el.style.cssText = orig; });
      setCapturing(false);
    }
  }, [capturing]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    handlers.onPointerUp(e);
    if (!wasDragged.current) {
      setInitialDescription("");
      capture();
    }
  }, [handlers, capture, wasDragged]);

  const handleToggleVoice = useCallback(() => {
    speechControlRef.current?.toggle();
  }, []);

  const handleSpeechStateChange = useCallback((state: { isListening: boolean; isSupported: boolean }) => {
    setSpeechState(state);
  }, []);

  return (
    <>
      {overlayOpen && (
        <FloatingMicButton
          onToggleVoice={handleToggleVoice}
          isListening={speechState.isListening}
          isSupported={speechState.isSupported}
        />
      )}

      <button
        ref={btnRef}
        data-feedback-btn="true"
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlePointerUp}
        className="fixed z-[9999] w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-white/30 flex items-center justify-center hover:scale-110 transition-transform cursor-grab active:cursor-grabbing select-none"
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
          onClose={() => { setOverlayOpen(false); setInitialDescription(""); }}
          screenshotDataUrl={screenshot}
          initialDescription={initialDescription}
          speechControlRef={speechControlRef}
          onSpeechStateChange={handleSpeechStateChange}
        />
      )}
    </>
  );
}
