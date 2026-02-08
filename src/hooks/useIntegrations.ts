import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { defaultIntegrations } from "@/components/integrations/integrationsList";
import type { Integration } from "@/components/integrations/IntegrationCard";

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const { toast } = useToast();

  // Google services that get connected together
  const googleIntegrations = ["gmail", "google-calendar", "google-drive", "youtube", "google-analytics", "google-search-console"];
  const metaIntegrations = ["facebook", "instagram"];

  // Load per-user statuses from database on mount
  useEffect(() => {
    loadIntegrationStatuses();
  }, []);

  const loadIntegrationStatuses = async () => {
    try {
      // RLS ensures we only get the current user's connections
      const { data: connections, error } = await supabase
        .from("integration_connections")
        .select("*");

      if (error) return;

      if (connections && connections.length > 0) {
        setIntegrations((prev) =>
          prev.map((integration) => {
            const connection = connections.find(
              (c) => c.integration_id === integration.id
            );
            if (connection) {
              return {
                ...integration,
                status: connection.status as Integration["status"],
                error: connection.error_message || undefined,
                lastSync: connection.last_sync_at
                  ? new Date(connection.last_sync_at).toLocaleTimeString()
                  : undefined,
              };
            }
            return integration;
          })
        );
      }
    } catch (err) {
      // Silently skip
    } finally {
      setLoading(false);
    }
  };

  const checkIntegrationStatus = useCallback(async (integrationId: string) => {
    setTesting(integrationId);
    
    try {
      if (metaIntegrations.includes(integrationId)) {
        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "facebook-oauth",
          { body: { action: "check-status", integration: integrationId } }
        );

        if (statusError) throw new Error(statusError.message);

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? {
                  ...i,
                  status: statusData.status,
                  error: statusData.error,
                  lastSync: statusData.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                }
              : i
          )
        );

        if (statusData.status === "connected") {
          toast({ title: `${integrationId} connected`, description: `Connected as ${statusData.profileName}` });
        } else if (statusData.status === "error") {
          toast({ title: "Connection error", description: statusData.error, variant: "destructive" });
        }

        return statusData.status;
      }

      // LinkedIn
      if (integrationId === "linkedin") {
        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "linkedin-oauth",
          { body: { action: "check-status" } }
        );

        if (statusError) throw new Error(statusError.message);

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "linkedin"
              ? {
                  ...i,
                  status: statusData.status,
                  error: statusData.error,
                  lastSync: statusData.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                }
              : i
          )
        );

        if (statusData.status === "connected") {
          toast({ title: "LinkedIn connected", description: `Connected as ${statusData.profileName}` });
        }
        return statusData.status;
      }

      // TikTok
      if (integrationId === "tiktok") {
        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "tiktok-oauth",
          { body: { action: "check-status" } }
        );

        if (statusError) throw new Error(statusError.message);

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "tiktok"
              ? {
                  ...i,
                  status: statusData.status,
                  error: statusData.error,
                  lastSync: statusData.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                }
              : i
          )
        );

        if (statusData.status === "connected") {
          toast({ title: "TikTok connected", description: `Connected as ${statusData.displayName}` });
        }
        return statusData.status;
      }

      if (googleIntegrations.includes(integrationId)) {
        // Check status for any Google service (they share a single token)
        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "google-oauth",
          { body: { action: "check-status", integration: integrationId } }
        );

        if (statusError) throw new Error(statusError.message);

        // If connected, update ALL Google services
        if (statusData.status === "connected") {
          setIntegrations((prev) =>
            prev.map((i) =>
              googleIntegrations.includes(i.id)
                ? {
                    ...i,
                    status: "connected" as const,
                    error: undefined,
                    lastSync: new Date().toLocaleTimeString(),
                  }
                : i
            )
          );
          toast({ title: "Google connected", description: `Connected as ${statusData.email}` });
        } else {
          setIntegrations((prev) =>
            prev.map((i) =>
              i.id === integrationId
                ? { ...i, status: statusData.status, error: statusData.error }
                : i
            )
          );
        }

        return statusData.status;
      }

      if (integrationId === "quickbooks") {
        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "quickbooks-oauth",
          { body: { action: "check-status" } }
        );

        if (statusError) throw new Error(statusError.message);

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "quickbooks"
              ? {
                  ...i,
                  status: statusData.status,
                  error: statusData.error,
                  lastSync: statusData.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                }
              : i
          )
        );

        return statusData.status;
      }

      if (integrationId === "ringcentral") {
        const { data, error } = await supabase.functions.invoke("ringcentral-sync", {
          body: { syncType: "calls", daysBack: 1 },
        });

        const status = error ? "error" : "connected";

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, status, error: error?.message, lastSync: error ? undefined : new Date().toLocaleTimeString() }
              : i
          )
        );

        if (!error) {
          toast({ title: "RingCentral connected", description: "Integration verified" });
        }
        return status;
      }

      toast({ title: "No test available", description: "This integration doesn't have a test endpoint" });
      return "available";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      toast({ title: "Connection failed", description: message, variant: "destructive" });
      
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integrationId ? { ...i, status: "error", error: message } : i
        )
      );
      return "error";
    } finally {
      setTesting(null);
    }
  }, [toast]);

  const checkAllStatuses = useCallback(async () => {
    setLoading(true);
    
    // Check Google (one check covers all Google services)
    try {
      const { data: statusData } = await supabase.functions.invoke(
        "google-oauth",
        { body: { action: "check-status", integration: "gmail" } }
      );

      if (statusData?.status === "connected") {
        setIntegrations((prev) =>
          prev.map((i) =>
            googleIntegrations.includes(i.id)
              ? {
                  ...i,
                  status: "connected" as const,
                  error: undefined,
                  lastSync: new Date().toLocaleTimeString(),
                }
              : i
          )
        );
      }
    } catch (err) {
      // Silently skip
    }

    // Check QuickBooks
    try {
      const { data: qbStatus, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "check-status" },
      });

      if (qbStatus && !error) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "quickbooks"
              ? {
                  ...i,
                  status: qbStatus.status,
                  error: qbStatus.error,
                  lastSync: qbStatus.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                }
              : i
          )
        );
      }
    } catch (err) {
      // Silently skip
    }

    // Check Meta (Facebook & Instagram)
    for (const id of metaIntegrations) {
      try {
        const { data: metaStatus } = await supabase.functions.invoke("facebook-oauth", {
          body: { action: "check-status", integration: id },
        });

        if (metaStatus) {
          setIntegrations((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: metaStatus.status,
                    error: metaStatus.error,
                    lastSync: metaStatus.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                  }
                : i
            )
          );
        }
      } catch (err) {
        // Silently skip
      }
    }

    // Check RingCentral
    try {
      const { error } = await supabase.functions.invoke("ringcentral-sync", {
        body: { syncType: "calls", daysBack: 1 },
      });

      const rcStatus = error ? "error" : "connected";

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "ringcentral"
            ? {
                ...i,
                status: rcStatus as Integration["status"],
                error: error?.message,
                lastSync: error ? undefined : new Date().toLocaleTimeString(),
              }
            : i
        )
      );
    } catch (err) {
      // Silently skip
    }

    // Check LinkedIn
    try {
      const { data: liStatus } = await supabase.functions.invoke("linkedin-oauth", {
        body: { action: "check-status" },
      });

      if (liStatus) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "linkedin"
              ? {
                  ...i,
                  status: liStatus.status,
                  error: liStatus.error,
                  lastSync: liStatus.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                }
              : i
          )
        );
      }
    } catch (err) {
      // Silently skip
    }

    // Check TikTok
    try {
      const { data: ttStatus } = await supabase.functions.invoke("tiktok-oauth", {
        body: { action: "check-status" },
      });

      if (ttStatus) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === "tiktok"
              ? {
                  ...i,
                  status: ttStatus.status,
                  error: ttStatus.error,
                  lastSync: ttStatus.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                }
              : i
          )
        );
      }
    } catch (err) {
      // Silently skip
    }

    setLoading(false);
  }, []);

  const openOAuthPopup = useCallback((url: string, integrationId: string) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      url,
      `oauth_${integrationId}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup || popup.closed) {
      toast({ title: "Popup blocked", description: "Please allow popups for this site and try again.", variant: "destructive" });
      return;
    }

    // Poll for popup close & listen for success message
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        // Refresh statuses after popup closes
        loadIntegrationStatuses();
      }
    }, 1000);

    // Safety: stop polling after 5 minutes
    setTimeout(() => clearInterval(pollTimer), 5 * 60 * 1000);
  }, [toast]);

  const startOAuth = useCallback(async (integrationId: string) => {
    try {
      const redirectUri = "https://erp.rebar.shop/integrations/callback";

      // QuickBooks
      if (integrationId === "quickbooks") {
        const { data, error } = await supabase.functions.invoke(
          "quickbooks-oauth",
          { body: { action: "get-auth-url", returnUrl: window.location.href } }
        );
        if (error) throw new Error(error.message);
        openOAuthPopup(data.authUrl, integrationId);
        return;
      }

      // Facebook / Instagram — Meta OAuth
      if (metaIntegrations.includes(integrationId)) {
        const { data, error } = await supabase.functions.invoke(
          "facebook-oauth",
          { body: { action: "get-auth-url", integration: integrationId, redirectUri } }
        );
        if (error) throw new Error(error.message);
        openOAuthPopup(data.authUrl, integrationId);
        return;
      }

      // LinkedIn
      if (integrationId === "linkedin") {
        const { data, error } = await supabase.functions.invoke(
          "linkedin-oauth",
          { body: { action: "get-auth-url", returnUrl: window.location.href } }
        );
        if (error) throw new Error(error.message);
        openOAuthPopup(data.authUrl, integrationId);
        return;
      }

      // TikTok
      if (integrationId === "tiktok") {
        const { data, error } = await supabase.functions.invoke(
          "tiktok-oauth",
          { body: { action: "get-auth-url", returnUrl: window.location.href } }
        );
        if (error) throw new Error(error.message);
        openOAuthPopup(data.authUrl, integrationId);
        return;
      }

      // Google integrations — unified flow
      const { data, error } = await supabase.functions.invoke(
        "google-oauth",
        { body: { action: "get-auth-url", integration: integrationId, redirectUri } }
      );
      if (error) throw new Error(error.message);
      openOAuthPopup(data.authUrl, integrationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start OAuth";
      toast({ title: "OAuth Error", description: message, variant: "destructive" });
    }
  }, [toast, openOAuthPopup]);

  const disconnectIntegration = useCallback(async (integrationId: string) => {
    setDisconnecting(integrationId);
    try {
      if (googleIntegrations.includes(integrationId)) {
        // Disconnect ALL Google services at once
        await supabase.functions.invoke("google-oauth", {
          body: { action: "disconnect", integration: integrationId },
        });

        // Reset all Google services in local state
        setIntegrations((prev) =>
          prev.map((i) =>
            googleIntegrations.includes(i.id)
              ? { ...i, status: "available" as const, error: undefined, lastSync: undefined }
              : i
          )
        );

        toast({ title: "Google disconnected", description: "All Google services have been disconnected." });
      } else if (metaIntegrations.includes(integrationId)) {
        await supabase.functions.invoke("facebook-oauth", {
          body: { action: "disconnect", integration: integrationId },
        });

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, status: "available" as const, error: undefined, lastSync: undefined }
              : i
          )
        );

        toast({ title: "Disconnected", description: `${integrationId} has been disconnected.` });
      } else if (integrationId === "quickbooks") {
        await supabase.functions.invoke("quickbooks-oauth", {
          body: { action: "disconnect" },
        });

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, status: "available" as const, error: undefined, lastSync: undefined }
              : i
          )
        );

        toast({ title: "Disconnected", description: "QuickBooks has been disconnected." });
      } else if (integrationId === "linkedin") {
        await supabase.functions.invoke("linkedin-oauth", {
          body: { action: "disconnect" },
        });

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, status: "available" as const, error: undefined, lastSync: undefined }
              : i
          )
        );

        toast({ title: "Disconnected", description: "LinkedIn has been disconnected." });
      } else if (integrationId === "tiktok") {
        await supabase.functions.invoke("tiktok-oauth", {
          body: { action: "disconnect" },
        });

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, status: "available" as const, error: undefined, lastSync: undefined }
              : i
          )
        );

        toast({ title: "Disconnected", description: "TikTok has been disconnected." });
      } else {
        // Generic: delete from integration_connections (RLS scopes to current user)
        await supabase
          .from("integration_connections")
          .delete()
          .eq("integration_id", integrationId);

        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? { ...i, status: "available" as const, error: undefined, lastSync: undefined }
              : i
          )
        );

        toast({ title: "Disconnected", description: `${integrationId} has been disconnected.` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disconnect";
      toast({ title: "Disconnect failed", description: message, variant: "destructive" });
    } finally {
      setDisconnecting(null);
    }
  }, [toast]);

  return {
    integrations,
    loading,
    testing,
    disconnecting,
    checkIntegrationStatus,
    checkAllStatuses,
    startOAuth,
    disconnectIntegration,
    refreshStatuses: loadIntegrationStatuses,
  };
}