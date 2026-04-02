import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { IntegrationCard, type Integration } from "@/components/integrations/IntegrationCard";
import { IntegrationSetupDialog } from "@/components/integrations/IntegrationSetupDialog";
import { ConnectDialog } from "@/components/integrations/ConnectDialog";
import { useIntegrations } from "@/hooks/useIntegrations";
import { StripeQBSyncPanel } from "@/components/integrations/StripeQBSyncPanel";
import { supabase } from "@/integrations/supabase/client";

interface StalenessInfo {
  source: string;
  label: string;
  lastReceived: string | null;
  hoursAgo: number | null;
}

function useStalenessCheck() {
  const [staleItems, setStaleItems] = useState<StalenessInfo[]>([]);

  const check = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query max received_at per source
      const { data: gmailData } = await supabase
        .from("communications")
        .select("received_at")
        .eq("user_id", user.id)
        .eq("source", "gmail")
        .order("received_at", { ascending: false })
        .limit(1);

      const { data: rcData } = await supabase
        .from("communications")
        .select("received_at")
        .eq("user_id", user.id)
        .eq("source", "ringcentral")
        .order("received_at", { ascending: false })
        .limit(1);

      // Also check integration_connections for last_sync_at
      const { data: syncRows } = await supabase
        .from("integration_connections")
        .select("integration_id, last_sync_at")
        .eq("user_id", user.id)
        .in("integration_id", ["gmail", "ringcentral"]);

      const syncMap: Record<string, string | null> = {};
      for (const row of syncRows ?? []) {
        syncMap[row.integration_id] = row.last_sync_at;
      }

      const now = Date.now();
      const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours
      const items: StalenessInfo[] = [];

      const sources = [
        { key: "gmail", label: "Gmail", data: gmailData },
        { key: "ringcentral", label: "RingCentral", data: rcData },
      ];

      for (const s of sources) {
        // If last_sync_at is recent, the connection is healthy — skip warning
        const lastSync = syncMap[s.key];
        if (lastSync) {
          const syncAge = now - new Date(lastSync).getTime();
          if (syncAge < STALE_THRESHOLD_MS) continue; // sync is healthy
        }

        if (s.data && s.data.length > 0) {
          const lastTime = new Date(s.data[0].received_at).getTime();
          const diff = now - lastTime;
          if (diff > STALE_THRESHOLD_MS) {
            items.push({
              source: s.key,
              label: s.label,
              lastReceived: s.data[0].received_at,
              hoursAgo: Math.round(diff / (1000 * 60 * 60)),
            });
          }
        }
      }

      setStaleItems(items);
    } catch (e) {
      console.warn("Staleness check failed:", e);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return staleItems;
}

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
  const staleItems = useStalenessCheck();

  const oauthIntegrations = [
    "gmail", "google-calendar", "google-drive", "youtube",
    "google-analytics", "google-search-console", "quickbooks",
    "facebook", "instagram", "linkedin", "tiktok", "ringcentral",
    "stripe", "rebar-shop", "synology-nas",
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

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-8">
        {/* Staleness warnings */}
        {staleItems.length > 0 && (
          <div className="space-y-2">
            {staleItems.map((item) => (
              <Alert key={item.source} variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{item.label} sync appears stale</AlertTitle>
                <AlertDescription>
                  Last data received {item.hoursAgo} hours ago. The connection may need to be re-authorized.
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

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

        {/* Stripe → QuickBooks Sync Panel */}
        <div className="border border-border rounded-lg p-6 bg-card">
          <StripeQBSyncPanel />
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