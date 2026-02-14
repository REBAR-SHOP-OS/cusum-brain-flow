import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent } from "@/lib/userAgentMap";
import assistantHelper from "@/assets/helpers/assistant-helper.png";

const STORAGE_KEY = "vizzy-btn-pos";
const BTN_SIZE = 56;
const DRAG_THRESHOLD = 5;
const LONG_PRESS_MS = 500;

const TOOLTIP_KEY = "vizzy-btn-tooltip-shown";

function getDefaultPos(isMobile: boolean) {
  const x = typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 24 : 300;
  const y = typeof window !== "undefined"
    ? window.innerHeight - BTN_SIZE - (isMobile ? 80 : 24)
    : 300;
  return { x, y };
}

function loadPos(isMobile: boolean) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch {}
  return getDefaultPos(isMobile);
}

function clamp(x: number, y: number) {
  const maxX = window.innerWidth - BTN_SIZE;
  const maxY = window.innerHeight - BTN_SIZE;
  return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
}

export const FloatingVizzyButton = React.forwardRef<HTMLButtonElement, {}>(
  function FloatingVizzyButton(_props, ref) {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const agent = getUserPrimaryAgent(user?.email);
    const avatarImg = agent?.image || assistantHelper;
    const agentName = agent?.name || "Vizzy";

    const [pos, setPos] = useState(() => loadPos(isMobile));
    const [showTooltip, setShowTooltip] = useState(false);
    const dragging = useRef(false);
    const startPointer = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });
    const moved = useRef(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPress = useRef(false);

    // Show tooltip on first use
    useEffect(() => {
      if (!localStorage.getItem(TOOLTIP_KEY)) {
        setShowTooltip(true);
        const timer = setTimeout(() => {
          setShowTooltip(false);
          localStorage.setItem(TOOLTIP_KEY, "1");
        }, 5000);
        return () => clearTimeout(timer);
      }
    }, []);

    // Re-clamp on resize
    useEffect(() => {
      const onResize = () => setPos((p: { x: number; y: number }) => clamp(p.x, p.y));
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
      dragging.current = true;
      moved.current = false;
      isLongPress.current = false;
      startPointer.current = { x: e.clientX, y: e.clientY };
      startPos.current = { ...pos };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
      }, LONG_PRESS_MS);
    }, [pos]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startPointer.current.x;
      const dy = e.clientY - startPointer.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        moved.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      const newPos = clamp(startPos.current.x + dx, startPos.current.y + dy);
      setPos(newPos);
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (moved.current) {
        const final = clamp(
          startPos.current.x + e.clientX - startPointer.current.x,
          startPos.current.y + e.clientY - startPointer.current.y
        );
        setPos(final);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
      } else {
        // Tap or long press → navigate
        if (location.pathname === "/chat") {
          navigate(-1);
        } else if (isLongPress.current) {
          navigate("/chat?voice=1");
        } else {
          navigate("/chat");
        }
      }

      // Hide tooltip after first interaction
      if (showTooltip) {
        setShowTooltip(false);
        localStorage.setItem(TOOLTIP_KEY, "1");
      }
    }, [location.pathname, navigate, showTooltip]);

    return (
      <button
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-50 group cursor-grab active:cursor-grabbing select-none"
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        aria-label={`Open ${agentName} AI Assistant`}
      >
        {/* Tooltip */}
        {showTooltip && (
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card text-foreground text-[10px] px-2 py-1 rounded-lg shadow-lg border border-border animate-fade-in">
            Tap to chat · Hold for voice
          </span>
        )}

        <span className="absolute inset-0 rounded-full animate-ping bg-teal-400/30" />
        <span className="absolute -inset-1 rounded-full border-2 border-teal-400/60 animate-pulse" />

        <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-teal-400 shadow-lg shadow-teal-500/25 transition-transform group-hover:scale-110">
          <img
            src={avatarImg}
            alt={`${agentName} AI`}
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        </div>

        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
      </button>
    );
  }
);
FloatingVizzyButton.displayName = "FloatingVizzyButton";
