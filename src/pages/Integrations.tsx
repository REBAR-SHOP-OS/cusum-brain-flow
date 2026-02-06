import { useState, useEffect } from "react";
import { CheckCircle2, Circle, ExternalLink, RefreshCw, AlertCircle, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "error" | "available" | "coming";
  icon: string;
  lastSync?: string;
  error?: string;
}

const defaultIntegrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Email sync & threading",
    status: "available",
    icon: "📧",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Accounting & invoicing",
    status: "coming",
    icon: "📊",
  },
  {
    id: "ringcentral",
    name: "RingCentral",
    description: "Calls & SMS logging",
    status: "available",
    icon: "📞",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Document storage",
    status: "coming",
    icon: "📁",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing",
    status: "coming",
    icon: "💳",
  },
];

function IntegrationCard({
  integration,
  onTest,
  onSettings,
  testing,
}: {
  integration: Integration;
  onTest: () => void;
  onSettings: () => void;
  testing: boolean;
}) {
  const isConnected = integration.status === "connected";
  const isError = integration.status === "error";
  const isAvailable = integration.status === "available";

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-colors",
        isConnected
          ? "bg-card border-success/30"
          : isError
          ? "bg-card border-destructive/30"
          : "bg-card border-border hover:border-primary/50"
      )}
    >
      <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-2xl">
        {integration.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{integration.name}</h3>
          {isConnected && <CheckCircle2 className="w-4 h-4 text-success" />}
          {isError && <AlertCircle className="w-4 h-4 text-destructive" />}
        </div>
        <p className="text-sm text-muted-foreground">{integration.description}</p>
        {integration.lastSync && (
          <p className="text-xs text-muted-foreground mt-1">
            Last sync: {integration.lastSync}
          </p>
        )}
        {integration.error && (
          <p className="text-xs text-destructive mt-1">{integration.error}</p>
        )}
      </div>

      {isConnected || isError ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={onSettings}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      ) : isAvailable ? (
        <Button size="sm" onClick={onSettings}>
          Connect
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground px-2 py-1 bg-secondary rounded">
          Coming soon
        </span>
      )}
    </div>
  );
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [testing, setTesting] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<string | null>(null);
  const { toast } = useToast();

  // Check integration statuses on mount
  useEffect(() => {
    checkIntegrationStatuses();
  }, []);

  const checkIntegrationStatuses = async () => {
    // Check Gmail
    try {
      const { error } = await supabase.functions.invoke("gmail-sync", {
        body: { maxResults: 1 },
      });
      
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "gmail"
            ? {
                ...i,
                status: error ? "error" : "connected",
                error: error?.message,
                lastSync: error ? undefined : new Date().toLocaleTimeString(),
              }
            : i
        )
      );
    } catch (error) {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "gmail"
            ? { ...i, status: "error", error: "Failed to connect" }
            : i
        )
      );
    }

    // Check RingCentral
    try {
      const { error } = await supabase.functions.invoke("ringcentral-sync", {
        body: { limit: 1 },
      });
      
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "ringcentral"
            ? {
                ...i,
                status: error ? "error" : "connected",
                error: error?.message,
                lastSync: error ? undefined : new Date().toLocaleTimeString(),
              }
            : i
        )
      );
    } catch (error) {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "ringcentral"
            ? { ...i, status: "error", error: "Failed to connect" }
            : i
        )
      );
    }
  };

  const testIntegration = async (id: string) => {
    setTesting(id);
    try {
      if (id === "gmail") {
        const { data, error } = await supabase.functions.invoke("gmail-sync", {
          body: { maxResults: 5 },
        });
        
        if (error) throw new Error(error.message);
        
        toast({
          title: "Gmail connected",
          description: `Synced ${data?.messages?.length || 0} emails`,
        });
        
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "gmail"
              ? { ...i, status: "connected", error: undefined, lastSync: new Date().toLocaleTimeString() }
              : i
          )
        );
      } else if (id === "ringcentral") {
        const { data, error } = await supabase.functions.invoke("ringcentral-sync", {
          body: { limit: 5 },
        });
        
        if (error) throw new Error(error.message);
        
        toast({
          title: "RingCentral connected",
          description: `Synced ${data?.calls?.length || 0} calls`,
        });
        
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "ringcentral"
              ? { ...i, status: "connected", error: undefined, lastSync: new Date().toLocaleTimeString() }
              : i
          )
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
      
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "error", error: message } : i
        )
      );
    } finally {
      setTesting(null);
    }
  };

  const connected = integrations.filter((i) => i.status === "connected" || i.status === "error");
  const available = integrations.filter((i) => i.status === "available" || i.status === "coming");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">Connect your tools</p>
        </div>
        <Button variant="outline" size="sm" onClick={checkIntegrationStatuses}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-8">
        {/* Connected */}
        {connected.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <h2 className="text-sm font-medium text-muted-foreground">
                CONNECTED ({connected.filter((c) => c.status === "connected").length})
              </h2>
            </div>
            <div className="space-y-3">
              {connected.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onTest={() => testIntegration(integration.id)}
                  onSettings={() => setSettingsOpen(integration.id)}
                  testing={testing === integration.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Available */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Circle className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground">
              AVAILABLE ({available.length})
            </h2>
          </div>
          <div className="space-y-3">
            {available.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onTest={() => testIntegration(integration.id)}
                onSettings={() => setSettingsOpen(integration.id)}
                testing={testing === integration.id}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Settings Dialog */}
      <Dialog open={!!settingsOpen} onOpenChange={() => setSettingsOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {settingsOpen === "gmail" && "Gmail Settings"}
              {settingsOpen === "ringcentral" && "RingCentral Settings"}
              {settingsOpen === "quickbooks" && "QuickBooks Settings"}
              {settingsOpen === "google-drive" && "Google Drive Settings"}
              {settingsOpen === "stripe" && "Stripe Settings"}
            </DialogTitle>
            <DialogDescription>
              {settingsOpen === "gmail" && (
                <>
                  Gmail integration uses OAuth to sync emails. The refresh token has expired.
                  <br /><br />
                  <strong>To fix:</strong>
                  <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
                    <li>Go to <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener" className="text-primary underline">OAuth Playground</a></li>
                    <li>Select Gmail API scopes (readonly + send)</li>
                    <li>Authorize with your Gmail account</li>
                    <li>Exchange for refresh token</li>
                    <li>Update the GMAIL_REFRESH_TOKEN secret in Lovable Cloud</li>
                  </ol>
                </>
              )}
              {settingsOpen === "ringcentral" && (
                <>
                  RingCentral integration uses JWT for authentication.
                  <br /><br />
                  Configure your RingCentral credentials in Lovable Cloud secrets:
                  <ul className="list-disc ml-4 mt-2 space-y-1 text-sm">
                    <li>RINGCENTRAL_CLIENT_ID</li>
                    <li>RINGCENTRAL_CLIENT_SECRET</li>
                    <li>RINGCENTRAL_JWT</li>
                  </ul>
                </>
              )}
              {(settingsOpen === "quickbooks" || settingsOpen === "google-drive" || settingsOpen === "stripe") && (
                "This integration is coming soon."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSettingsOpen(null)}>
              Close
            </Button>
            {(settingsOpen === "gmail" || settingsOpen === "ringcentral") && (
              <Button onClick={() => {
                testIntegration(settingsOpen);
                setSettingsOpen(null);
              }}>
                Test Connection
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
