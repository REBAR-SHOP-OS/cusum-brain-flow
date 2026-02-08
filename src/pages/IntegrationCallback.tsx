import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IntegrationCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle server-side callback results (redirect from edge function)
    const callbackStatus = searchParams.get("status");
    if (callbackStatus === "success") {
      setStatus("success");
      const integration = searchParams.get("integration") || "";
      const email = searchParams.get("email");
      setMessage(email ? `Connected as ${email}!` : `${integration} connected successfully!`);
      if (window.opener) {
        try { window.opener.postMessage({ type: "oauth-success" }, "*"); } catch {}
        setTimeout(() => window.close(), 1500);
      } else {
        setTimeout(() => navigate(integration === "gmail" ? "/inbox" : "/integrations"), 2000);
      }
      return;
    }
    if (callbackStatus === "error") {
      setStatus("error");
      setMessage(searchParams.get("message") || "Connection failed");
      return;
    }

    // Handle client-side OAuth callback (code exchange)
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

    const waitForAuthAndExchange = async () => {
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
  }, [searchParams, navigate]);

  const exchangeCode = async (code: string, integration: string) => {
    try {
      const redirectUri = "https://erp.rebar.shop/integrations/callback";

      // Route to the correct edge function based on integration
      const metaIntegrations = ["facebook", "instagram"];
      // "google" state means unified Google connect
      const isGoogle = integration === "google" || [
        "gmail", "google-calendar", "google-drive", "youtube", "google-analytics", "google-search-console"
      ].includes(integration);

      const edgeFunction = metaIntegrations.includes(integration)
        ? "facebook-oauth"
        : integration === "ringcentral"
          ? "ringcentral-oauth"
          : isGoogle
            ? "google-oauth"
            : "google-oauth";

      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: {
          action: "exchange-code",
          code,
          redirectUri,
          integration,
        },
      });

      if (error) throw new Error(error.message);

      setStatus("success");
      setMessage(data.message || "Successfully connected!");

      // If opened as popup, notify opener and close; otherwise redirect
      if (window.opener) {
        try { window.opener.postMessage({ type: "oauth-success" }, "*"); } catch {}
        setTimeout(() => window.close(), 1500);
      } else {
        setTimeout(() => navigate("/integrations"), 2000);
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to complete authorization");
    }
  };

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
