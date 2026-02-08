import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationCard, type Integration } from "@/components/integrations/IntegrationCard";
import { IntegrationSetupDialog } from "@/components/integrations/IntegrationSetupDialog";
import { ConnectDialog } from "@/components/integrations/ConnectDialog";
import { useIntegrations } from "@/hooks/useIntegrations";

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
  const [connectDialogIntegration, setConnectDialogIntegration] = useState<Integration | null>(null);
  const [connecting, setConnecting] = useState(false);

  const oauthIntegrations = [
    "gmail", "google-calendar", "google-drive", "youtube",
    "google-analytics", "google-search-console", "quickbooks",
    "facebook", "instagram", "linkedin", "tiktok",
  ];

  // Listen for OAuth success messages from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success") {
        refreshStatuses();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refreshStatuses]);

  useEffect(() => {
    checkAllStatuses();
  }, []);

  const handleCardClick = (integration: Integration) => {
    if (integration.status === "connected") {
      checkIntegrationStatus(integration.id);
    } else if (oauthIntegrations.includes(integration.id)) {
      // Show pre-connect dialog for OAuth integrations
      setConnectDialogIntegration(integration);
    } else {
      setSelectedIntegration(integration);
    }
  };

  const handleOAuthConnect = async (integrationId: string) => {
    setConnecting(true);
    await startOAuth(integrationId);
    setConnecting(false);
    setConnectDialogIntegration(null);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onClick={() => handleCardClick(integration)}
              onDisconnect={integration.status === "connected" ? disconnectIntegration : undefined}
              testing={testing === integration.id}
              disconnecting={disconnecting === integration.id}
            />
          ))}
        </div>
      </div>

      {/* Pre-connect dialog for OAuth integrations */}
      <ConnectDialog
        integration={connectDialogIntegration}
        open={!!connectDialogIntegration}
        onOpenChange={(open) => !open && setConnectDialogIntegration(null)}
        onConnect={handleOAuthConnect}
        connecting={connecting}
      />

      {/* Setup Dialog for non-OAuth integrations */}
      <IntegrationSetupDialog
        integration={selectedIntegration}
        open={!!selectedIntegration}
        onOpenChange={(open) => !open && setSelectedIntegration(null)}
      />
    </div>
  );
}
