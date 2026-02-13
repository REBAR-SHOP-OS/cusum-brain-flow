import React from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent } from "@/lib/userAgentMap";
import assistantHelper from "@/assets/helpers/assistant-helper.png";

export const FloatingVizzyButton = React.forwardRef<HTMLButtonElement, {}>(
  function FloatingVizzyButton(_props, ref) {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { user } = useAuth();
    const agent = getUserPrimaryAgent(user?.email);
    const avatarImg = agent?.image || assistantHelper;
    const agentName = agent?.name || "Vizzy";

    const handleClick = () => {
      navigate("/chat");
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={`fixed z-50 group cursor-pointer ${
          isMobile ? "bottom-20 right-4" : "bottom-6 right-6"
        }`}
        aria-label={`Open ${agentName} AI Assistant`}
      >
        <span className="absolute inset-0 rounded-full animate-ping bg-teal-400/30" />
        <span className="absolute -inset-1 rounded-full border-2 border-teal-400/60 animate-pulse" />

        <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-teal-400 shadow-lg shadow-teal-500/25 transition-transform group-hover:scale-110">
          <img
            src={avatarImg}
            alt={`${agentName} AI`}
            className="w-full h-full object-cover"
          />
        </div>

        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
      </button>
    );
  }
);
FloatingVizzyButton.displayName = "FloatingVizzyButton";
