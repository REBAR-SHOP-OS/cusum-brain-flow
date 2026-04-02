import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { VizzyVoiceChat } from "@/components/vizzy/VizzyVoiceChat";
import { primeMobileAudio } from "@/lib/audioPlayer";
import { Mic } from "lucide-react";

export default function VizzyLive() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useSuperAdmin();
  const { user, loading } = useAuth();
  const [sessionStarted, setSessionStarted] = useState(false);

  if (loading) return null;
  if (!user || !isSuperAdmin) return <Navigate to="/home" replace />;

  if (!sessionStarted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
        style={{
          background: "radial-gradient(ellipse at center, hsl(200 25% 10%) 0%, hsl(210 30% 6%) 100%)",
        }}
      >
        <p className="text-sm text-center max-w-sm" style={{ color: "hsl(172 30% 70%)" }}>
          Tap below to unlock voice output in your browser, then Vizzy will connect.
        </p>
        <button
          type="button"
          onClick={() => {
            primeMobileAudio();
            setSessionStarted(true);
          }}
          className="flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold shadow-lg transition-transform hover:scale-[1.02]"
          style={{
            background: "linear-gradient(135deg, hsl(172 66% 40%), hsl(172 66% 55%))",
            color: "white",
            boxShadow: "0 0 24px hsl(172 66% 50% / 0.35)",
          }}
        >
          <Mic className="w-5 h-5" />
          Start voice session
        </button>
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="text-xs underline opacity-70 hover:opacity-100"
          style={{ color: "hsl(0 0% 65%)" }}
        >
          Back to home
        </button>
      </div>
    );
  }

  return <VizzyVoiceChat onClose={() => navigate("/home")} />;
}
