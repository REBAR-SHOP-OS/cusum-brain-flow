import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IntegrationCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // integration id
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(`Authorization denied: ${error}`);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Missing authorization code or state");
      return;
    }

    // Wait for auth session to be available before exchanging code
    const waitForAuthAndExchange = async () => {
      // Give Supabase a moment to restore the session from localStorage
      let retries = 0;
      let session = null;
      
      while (retries < 5) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (session) break;
        retries++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!session) {
        setStatus("error");
        setMessage("Session expired. Please log in and try connecting again.");
        return;
      }

      await exchangeCode(code, state);
    };

    waitForAuthAndExchange();
  }, [searchParams]);

  const exchangeCode = async (code: string, integration: string) => {
    try {
      const redirectUri = `${window.location.origin}/integrations/callback`;

      const { data, error } = await supabase.functions.invoke(
        "google-oauth",
        {
          body: {
            action: "exchange-code",
            code,
            redirectUri,
            integration,
          },
        }
      );

      if (error) throw new Error(error.message);

      setStatus("success");
      setMessage(data.message || "Successfully connected!");
      
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      } else {
        // No refresh token to display, redirect to integrations after a brief delay
        setTimeout(() => navigate("/integrations"), 2000);
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to complete authorization");
    }
  };

  const copyToken = async () => {
    if (refreshToken) {
      await navigator.clipboard.writeText(refreshToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToIntegrations = () => {
    navigate("/integrations");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
            <h1 className="text-xl font-semibold">Completing Authorization...</h1>
            <p className="text-muted-foreground">Please wait while we connect your account.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
            <h1 className="text-xl font-semibold text-success">Connected Successfully!</h1>
            <p className="text-muted-foreground">{message}</p>

            {refreshToken && (
              <div className="bg-muted p-4 rounded-lg text-left space-y-3">
                <p className="text-sm font-medium">Save this refresh token as a secret:</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-background p-2 rounded border overflow-x-auto">
                    {refreshToken.slice(0, 30)}...
                  </code>
                  <Button size="sm" variant="outline" onClick={copyToken}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this to your project secrets in Lovable Cloud → Settings → Secrets
                </p>
              </div>
            )}

            <Button onClick={goToIntegrations} className="w-full">
              Go to Integrations
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold text-destructive">Connection Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={goToIntegrations}>
              Back to Integrations
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
