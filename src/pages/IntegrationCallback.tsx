import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IntegrationCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const callbackStatus = searchParams.get("status");
    const integration = searchParams.get("integration") || "";
    const errorMessage = searchParams.get("message");
    const email = searchParams.get("email");

    if (callbackStatus === "success") {
      setStatus("success");
      const label = integration || "your account";
      setMessage(email ? `Connected as ${email}!` : `${label} connected successfully!`);

      // Auto-redirect after success
      setTimeout(() => {
        if (integration === "gmail" || integration === "ringcentral") {
          navigate("/inbox");
        } else {
          navigate("/integrations");
        }
      }, 2000);
    } else if (callbackStatus === "error") {
      setStatus("error");
      setMessage(errorMessage || "Connection failed");
    } else {
      // Legacy flow or unexpected state
      setStatus("error");
      setMessage("Unexpected callback. Please try connecting again.");
    }
  }, [searchParams, navigate]);

  const goBack = () => {
    navigate("/integrations");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
            <h1 className="text-xl font-semibold">Connecting your account...</h1>
            <p className="text-muted-foreground">Please wait while we link your account.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <h1 className="text-xl font-semibold text-green-500">Account Connected!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold text-destructive">Connection Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={goBack}>
              Back to Integrations
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
