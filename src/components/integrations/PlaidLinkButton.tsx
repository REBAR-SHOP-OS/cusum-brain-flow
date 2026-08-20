import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Landmark, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useBankConnections } from "@/hooks/useBankConnections";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const { createLinkToken, exchangeToken } = useBankConnections();
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { link_token } = await createLinkToken();

      // Dynamically load Plaid Link
      const Plaid = await loadPlaidLink();
      const handler = Plaid.create({
        token: link_token,
        onSuccess: async (publicToken: string, metadata: any) => {
          try {
            const institutionName = metadata?.institution?.name || "Bank";
            await exchangeToken(publicToken, institutionName);
            toast.success(`Connected to ${institutionName}!`);
            onSuccess?.();
          } catch (err: any) {
            toast.error(`Failed to link bank: ${err.message}`);
          }
        },
        onExit: (err: any) => {
          if (err) {
            console.warn("Plaid Link exit error:", err);
          }
          setLoading(false);
        },
      });
      handler.open();
    } catch (err: any) {
      toast.error(`Failed to initialize: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
      Connect Bank Account
    </Button>
  );
}

// Lazy load Plaid Link SDK
function loadPlaidLink(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Plaid) {
      resolve((window as any).Plaid);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.onload = () => {
      if ((window as any).Plaid) {
        resolve((window as any).Plaid);
      } else {
        reject(new Error("Plaid SDK failed to load"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Plaid SDK"));
    document.head.appendChild(script);
  });
}
