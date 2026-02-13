import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import vizzyAvatar from "@/assets/vizzy-avatar.png";

export const FloatingVizzyButton = React.forwardRef<HTMLButtonElement, {}>(
  function FloatingVizzyButton(_props, ref) {
    const isMobile = useIsMobile();

    const handleClick = () => {
      window.dispatchEvent(new CustomEvent("toggle-live-chat"));
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={`fixed z-50 group cursor-pointer ${
          isMobile ? "bottom-20 right-4" : "bottom-6 right-6"
        }`}
        aria-label="Open Vizzy AI Assistant"
      >
        {/* Pulsing teal ring */}
        <span className="absolute inset-0 rounded-full animate-ping bg-teal-400/30" />
        <span className="absolute -inset-1 rounded-full border-2 border-teal-400/60 animate-pulse" />

        {/* Avatar */}
        <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-teal-400 shadow-lg shadow-teal-500/25 transition-transform group-hover:scale-110">
          <img
            src={vizzyAvatar}
            alt="Vizzy AI"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Status dot */}
        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
      </button>
    );
  }
);
FloatingVizzyButton.displayName = "FloatingVizzyButton";
