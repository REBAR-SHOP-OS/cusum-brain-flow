import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid unsubscribe link.");
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("email-unsubscribe", {
          body: { token },
        });
        if (error) throw error;
        setStatus("success");
        setMessage(data?.message || "You have been successfully unsubscribed.");
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Something went wrong. Please try again.");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Processing your request...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Unsubscribed</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Error</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        <p className="text-xs text-muted-foreground pt-4">
          Rebar.Shop &bull; If you believe this was a mistake, contact us.
        </p>
      </div>
    </div>
  );
}
