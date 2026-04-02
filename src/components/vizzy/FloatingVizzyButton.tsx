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
import { primeMobileAudio } from "@/lib/audioPlayer";

const BTN_SIZE = 80;

export const FloatingVizzyButton = React.forwardRef<HTMLButtonElement, {}>(
  function FloatingVizzyButton(_props, ref) {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const location = useLocation();

    const [expanded, setExpanded] = useState(false);
    const [showVoiceChat, setShowVoiceChat] = useState(false);
    const [pulseActive] = useState(false);

    const { pos, handlers, wasDragged } = useDraggablePosition({
      storageKey: "vizzy-btn-pos",
      btnSize: BTN_SIZE,
      defaultPos: (mobile) => ({
        x: typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 20 : 300,
        y: typeof window !== "undefined" ? window.innerHeight - BTN_SIZE - (mobile ? 100 : 28) : 300,
      }),
    });

    // Pulse removed — clean face-only design

    const handleAvatarClick = useCallback(() => {
      if (wasDragged.current) return;
      setExpanded((p) => !p);
    }, [wasDragged]);

    const onMicClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      primeMobileAudio();
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

    // Hide on /vizzy full-screen route to avoid overlap
    if (location.pathname === "/vizzy") return null;

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
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, x: -50, y: -50 }}
                  exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0 }}
                  onClick={onMicClick}
                  className="absolute top-0 left-0 w-11 h-11 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, hsl(172 66% 40%), hsl(172 66% 55%))",
                  }}
                  aria-label="Start voice session"
                >
                  <Mic size={18} className="text-white" />
                </motion.button>

                {/* Chat button */}
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, x: 0, y: -70 }}
                  exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                  onClick={onChatClick}
                  className="absolute top-0 left-0 w-11 h-11 rounded-full flex items-center justify-center shadow-lg shadow-primary/30 cursor-pointer bg-primary"
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
            {/* Avatar container — face IS the button */}
            <div
              className="relative rounded-full overflow-hidden shadow-xl transition-transform duration-200 group-hover:scale-105"
              style={{
                width: BTN_SIZE,
                height: BTN_SIZE,
                boxShadow: "0 0 18px 2px hsl(172 66% 50% / 0.25), 0 4px 12px hsl(0 0% 0% / 0.35)",
                border: "2.5px solid hsl(172 66% 50% / 0.6)",
              }}
            >
              <img
                src={vizzyAvatar}
                alt="Vizzy AI"
                className="w-full h-full object-cover pointer-events-none"
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
