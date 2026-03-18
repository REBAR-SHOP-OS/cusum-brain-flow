import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { getFloatingPortalContainer } from "@/lib/floatingPortal";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import vizzyAvatar from "@/assets/vizzy-avatar.png";
import { VizzyVoiceChat } from "./VizzyVoiceChat";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { motion, AnimatePresence } from "framer-motion";

const BTN_SIZE = 64;

export const FloatingVizzyButton = React.forwardRef<HTMLButtonElement, {}>(
  function FloatingVizzyButton(_props, ref) {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const location = useLocation();

    const [expanded, setExpanded] = useState(false);
    const [showVoiceChat, setShowVoiceChat] = useState(false);
    const [pulseActive, setPulseActive] = useState(true);

    const { pos, handlers, wasDragged } = useDraggablePosition({
      storageKey: "vizzy-btn-pos",
      btnSize: BTN_SIZE,
      defaultPos: (mobile) => ({
        x: typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 20 : 300,
        y: typeof window !== "undefined" ? window.innerHeight - BTN_SIZE - (mobile ? 90 : 28) : 300,
      }),
    });

    // Hide on /vizzy full-screen route to avoid overlap
    if (location.pathname === "/vizzy") return null;

    // Stop pulse after 10 seconds
    useEffect(() => {
      const t = setTimeout(() => setPulseActive(false), 10000);
      return () => clearTimeout(t);
    }, []);

    const handleAvatarClick = useCallback(() => {
      if (wasDragged.current) return;
      setExpanded((p) => !p);
    }, [wasDragged]);

    const onMicClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded(false);
      setShowVoiceChat(true);
    }, []);

    const onChatClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded(false);
      if (location.pathname === "/chat") {
        navigate(-1);
      } else {
        navigate("/chat");
      }
    }, [location.pathname, navigate]);

    return createPortal(
      <>
        <AnimatePresence>
          {showVoiceChat && (
            <VizzyVoiceChat onClose={() => setShowVoiceChat(false)} />
          )}
        </AnimatePresence>

        <div
          data-feedback-btn="true"
          className="fixed select-none"
          style={{
            left: pos.x,
            top: pos.y,
            touchAction: "none",
            zIndex: 99999,
            pointerEvents: "auto",
          }}
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
        >
          {/* Action buttons */}
          <AnimatePresence>
            {expanded && (
              <>
                {/* Voice button */}
                <motion.button
                  initial={{ scale: 0, opacity: 0, y: 0 }}
                  animate={{ scale: 1, opacity: 1, y: -60 }}
                  exit={{ scale: 0, opacity: 0, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0 }}
                  onClick={onMicClick}
                  className="absolute left-1/2 -translate-x-1/2 w-11 h-11 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, hsl(172 66% 40%), hsl(172 66% 55%))",
                  }}
                  aria-label="Start voice session"
                >
                  <Mic size={18} className="text-white" />
                </motion.button>

                {/* Chat button */}
                <motion.button
                  initial={{ scale: 0, opacity: 0, x: 0 }}
                  animate={{ scale: 1, opacity: 1, x: -55, y: -25 }}
                  exit={{ scale: 0, opacity: 0, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                  onClick={onChatClick}
                  className="absolute left-1/2 -translate-x-1/2 w-11 h-11 rounded-full flex items-center justify-center shadow-lg shadow-primary/30 cursor-pointer bg-primary"
                  aria-label="Open text chat"
                >
                  <MessageSquare size={18} className="text-primary-foreground" />
                </motion.button>
              </>
            )}
          </AnimatePresence>

          {/* Main orbital button */}
          <button
            ref={ref}
            onClick={handleAvatarClick}
            className="relative cursor-grab active:cursor-grabbing group"
            aria-label="Open Vizzy AI Assistant"
          >
            {/* Outer orbital ring */}
            <svg
              className="absolute -inset-3"
              width={BTN_SIZE + 24}
              height={BTN_SIZE + 24}
              viewBox={`0 0 ${BTN_SIZE + 24} ${BTN_SIZE + 24}`}
            >
              <circle
                cx={(BTN_SIZE + 24) / 2}
                cy={(BTN_SIZE + 24) / 2}
                r={(BTN_SIZE + 24) / 2 - 3}
                fill="none"
                stroke="hsl(172 66% 50%)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                opacity="0.5"
                className="animate-[spin_12s_linear_infinite]"
              />
              <circle
                cx={(BTN_SIZE + 24) / 2}
                cy={(BTN_SIZE + 24) / 2}
                r={(BTN_SIZE + 24) / 2 - 3}
                fill="none"
                stroke="hsl(172 66% 50%)"
                strokeWidth="1.5"
                opacity="0.25"
              />
            </svg>

            {/* Pulse ring */}
            {pulseActive && (
              <span
                className="absolute -inset-1 rounded-full animate-ping"
                style={{ background: "hsl(172 66% 50% / 0.15)" }}
              />
            )}

            {/* Avatar container */}
            <div
              className="relative rounded-full overflow-hidden shadow-xl transition-transform duration-200 group-hover:scale-105"
              style={{
                width: BTN_SIZE,
                height: BTN_SIZE,
                boxShadow: "0 0 24px 4px hsl(172 66% 50% / 0.3), 0 4px 16px hsl(0 0% 0% / 0.4)",
                border: "2.5px solid hsl(172 66% 50% / 0.7)",
              }}
            >
              <img
                src={vizzyAvatar}
                alt="Vizzy AI"
                className="w-full h-full object-cover pointer-events-none"
                style={{ transform: "scale(1.8)", objectPosition: "center 38%" }}
                draggable={false}
              />
            </div>

            {/* Status dot */}
            <span
              className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2"
              style={{
                background: "hsl(152 69% 53%)",
                borderColor: "hsl(var(--background))",
                boxShadow: "0 0 6px hsl(152 69% 53% / 0.6)",
              }}
            />
          </button>
        </div>
      </>,
      getFloatingPortalContainer()
    );
  }
);
FloatingVizzyButton.displayName = "FloatingVizzyButton";
