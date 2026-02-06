import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { IntegrationCard, type Integration } from "@/components/integrations/IntegrationCard";
import { IntegrationSetupDialog } from "@/components/integrations/IntegrationSetupDialog";
import { defaultIntegrations } from "@/components/integrations/integrationsList";

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [testing, setTesting] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Don't auto-check on mount to avoid errors when credentials aren't configured
    // Users can manually click Refresh or the integration card to test
  }, []);

  const checkIntegrationStatuses = async () => {
    // Check Gmail - wrapped in try/catch to prevent page crashes
    try {
      const { data, error } = await supabase.functions.invoke("gmail-sync", {
        body: { maxResults: 1 },
      });

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "gmail"
            ? {
                ...i,
                status: error ? "error" : "connected",
                error: error ? extractErrorMessage(error.message) : undefined,
                lastSync: error ? undefined : new Date().toLocaleTimeString(),
              }
            : i
        )
      );
    } catch (err) {
      // Keep as available if function doesn't exist or fails completely
      console.log("Gmail check skipped:", err);
    }

    // Check RingCentral - wrapped in try/catch to prevent page crashes
    try {
      const { data, error } = await supabase.functions.invoke("ringcentral-sync", {
        body: { limit: 1 },
      });

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "ringcentral"
            ? {
                ...i,
                status: error ? "error" : "connected",
                error: error ? extractErrorMessage(error.message) : undefined,
                lastSync: error ? undefined : new Date().toLocaleTimeString(),
              }
            : i
        )
      );
    } catch (err) {
      // Keep as available if function doesn't exist or fails completely
      console.log("RingCentral check skipped:", err);
    }
  };

  const extractErrorMessage = (msg: string): string => {
    if (msg.includes("Token has been expired")) return "Token expired";
    if (msg.includes("invalid_grant")) return "Token revoked";
    if (msg.includes("invalid_client")) return "Invalid credentials";
    if (msg.includes("not configured")) return "Not configured";
    return msg.slice(0, 40);
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
      } else {
        toast({
          title: "Test not available",
          description: "This integration doesn't have a test endpoint yet",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      toast({
        title: "Connection failed",
        description: extractErrorMessage(message),
        variant: "destructive",
      });

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "error", error: extractErrorMessage(message) } : i
        )
      );
    } finally {
      setTesting(null);
    }
  };

  const handleCardClick = (integration: Integration) => {
    if (integration.status === "connected") {
      testIntegration(integration.id);
    } else {
      setSelectedIntegration(integration);
    }
  };

  const connected = integrations.filter((i) => i.status === "connected");
  const needsAttention = integrations.filter((i) => i.status === "error");
  const available = integrations.filter((i) => i.status === "available");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">Connect your tools & services</p>
        </div>
        <Button variant="outline" size="sm" onClick={checkIntegrationStatuses}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-destructive mb-4 uppercase tracking-wide">
              Needs Attention ({needsAttention.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {needsAttention.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onClick={() => handleCardClick(integration)}
                  testing={testing === integration.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Connected */}
        {connected.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
              Connected ({connected.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connected.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onClick={() => handleCardClick(integration)}
                  testing={testing === integration.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Available */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Available ({available.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {available.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onClick={() => handleCardClick(integration)}
                testing={testing === integration.id}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Setup Dialog */}
      <IntegrationSetupDialog
        integration={selectedIntegration}
        open={!!selectedIntegration}
        onOpenChange={(open) => !open && setSelectedIntegration(null)}
      />
    </div>
  );
}
