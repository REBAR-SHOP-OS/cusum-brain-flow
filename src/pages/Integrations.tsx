import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationCard, type Integration } from "@/components/integrations/IntegrationCard";
import { IntegrationSetupDialog } from "@/components/integrations/IntegrationSetupDialog";

import { useIntegrations } from "@/hooks/useIntegrations";
import { useState } from "react";

export default function Integrations() {
  const {
    integrations,
    loading,
    testing,
    disconnecting,
    checkIntegrationStatus,
    checkAllStatuses,
    startOAuth,
    disconnectIntegration,
    refreshStatuses,
  } = useIntegrations();

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Listen for OAuth success messages from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success") {
        // Refresh statuses after OAuth completes
        refreshStatuses();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refreshStatuses]);

  // Check statuses on mount
  useEffect(() => {
    checkAllStatuses();
  }, []);

  const handleCardClick = (integration: Integration) => {
    const oauthIntegrations = ["gmail", "google-calendar", "google-drive", "youtube", "google-analytics", "google-search-console", "quickbooks", "facebook", "instagram"];
    
    if (integration.status === "connected") {
      // Test the connection
      checkIntegrationStatus(integration.id);
    } else if (oauthIntegrations.includes(integration.id)) {
      // Start OAuth flow for OAuth integrations
      startOAuth(integration.id);
    } else {
      // Show manual setup dialog for other integrations
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
        <Button variant="outline" size="sm" onClick={checkAllStatuses} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
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
                  onDisconnect={disconnectIntegration}
                  testing={testing === integration.id}
                  disconnecting={disconnecting === integration.id}
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

      {/* Setup Dialog for non-OAuth integrations */}
      <IntegrationSetupDialog
        integration={selectedIntegration}
        open={!!selectedIntegration}
        onOpenChange={(open) => !open && setSelectedIntegration(null)}
      />
    </div>
  );
}
