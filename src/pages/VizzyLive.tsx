import { useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { VizzyVoiceChat } from "@/components/vizzy/VizzyVoiceChat";

export default function VizzyLive() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useSuperAdmin();
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || !isSuperAdmin) return <Navigate to="/home" replace />;

  return <VizzyVoiceChat onClose={() => navigate("/home")} />;
}
