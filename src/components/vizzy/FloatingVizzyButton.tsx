import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent } from "@/lib/userAgentMap";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import assistantHelper from "@/assets/helpers/assistant-helper.png";

const BTN_SIZE = 56;
const TOOLTIP_KEY = "vizzy-btn-tooltip-shown";

export const FloatingVizzyButton = React.forwardRef<HTMLButtonElement, {}>(
  function FloatingVizzyButton(_props, ref) {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const agent = getUserPrimaryAgent(user?.email);
    const avatarImg = agent?.image || assistantHelper;
    const agentName = agent?.name || "Vizzy";

    const [showTooltip, setShowTooltip] = useState(false);
    const [showActions, setShowActions] = useState(isMobile);

    const { pos, handlers, wasDragged } = useDraggablePosition({
      storageKey: "vizzy-btn-pos",
      btnSize: BTN_SIZE,
      defaultPos: (mobile) => ({
        x: typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 24 : 300,
        y: typeof window !== "undefined" ? window.innerHeight - BTN_SIZE - (mobile ? 80 : 24) : 300,
      }),
    });

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

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      handlers.onPointerUp(e);
      if (!wasDragged.current) {
        // Tap → navigate to text chat
        if (location.pathname === "/chat") {
          navigate(-1);
        } else {
          navigate("/chat");
        }
      }
      // Hide tooltip after first interaction
      if (showTooltip) {
        setShowTooltip(false);
        localStorage.setItem(TOOLTIP_KEY, "1");
      }
    }, [handlers, wasDragged, location.pathname, navigate, showTooltip]);

    const onMicClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      navigate("/chat?voice=1");
    }, [navigate]);

    return (
      <div
        className="fixed z-50 group"
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        onMouseEnter={() => !isMobile && setShowActions(true)}
        onMouseLeave={() => !isMobile && setShowActions(false)}
      >
        {/* Mic button - above avatar */}
        {showActions && (
          <button
            onClick={onMicClick}
            className="absolute -top-9 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-card border border-border ring-1 ring-teal-400/60 shadow-md flex items-center justify-center hover:bg-accent transition-all animate-fade-in"
            aria-label="Start voice chat"
          >
            <Mic size={14} className="text-teal-400" />
          </button>
        )}

        {/* Tooltip */}
        {showTooltip && (
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card text-foreground text-[10px] px-2 py-1 rounded-lg shadow-lg border border-border animate-fade-in">
            Tap to chat · 🎤 for voice
          </span>
        )}

        {/* Main avatar button */}
        <button
          ref={ref}
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlePointerUp}
          className="cursor-grab active:cursor-grabbing select-none"
          aria-label={`Open ${agentName} AI Assistant`}
        >
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
      </div>
    );
  }
);
FloatingVizzyButton.displayName = "FloatingVizzyButton";
