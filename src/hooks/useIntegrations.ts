import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { defaultIntegrations } from "@/components/integrations/integrationsList";
import type { Integration } from "@/components/integrations/IntegrationCard";

interface IntegrationConnection {
  integration_id: string;
  status: string;
  last_checked_at: string | null;
  last_sync_at: string | null;
  error_message: string | null;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const { toast } = useToast();

  // Load statuses from database on mount
  useEffect(() => {
    loadIntegrationStatuses();
  }, []);

  const loadIntegrationStatuses = async () => {
    try {
      const { data: connections, error } = await supabase
        .from("integration_connections")
        .select("*");

      if (error) {
        console.log("Could not load integration statuses:", error);
        return;
      }

      if (connections && connections.length > 0) {
        setIntegrations((prev) =>
          prev.map((integration) => {
            const connection = connections.find(
              (c: IntegrationConnection) => c.integration_id === integration.id
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
      console.log("Error loading integration statuses:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkIntegrationStatus = useCallback(async (integrationId: string) => {
    setTesting(integrationId);
    
    try {
      // For Google integrations, use the OAuth check endpoint
      const googleIntegrations = ["gmail", "google-calendar", "google-drive", "youtube", "google-analytics"];
      
      if (googleIntegrations.includes(integrationId)) {
        const { data, error } = await supabase.functions.invoke("google-oauth", {
          body: { integration: integrationId },
          headers: { "Content-Type": "application/json" },
        });

        // Add query param for action
        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "google-oauth",
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
          toast({ title: `${integrationId} connected`, description: "Integration verified" });
        } else if (statusData.status === "error") {
          toast({ title: "Connection error", description: statusData.error, variant: "destructive" });
        }

        return statusData.status;
      }

      // For other integrations, use their specific sync functions
      if (integrationId === "ringcentral") {
        const { data, error } = await supabase.functions.invoke("ringcentral-sync", {
          body: { limit: 1 },
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
    // Check Google integrations
    const googleIntegrations = ["gmail", "google-calendar", "google-drive"];
    
    for (const id of googleIntegrations) {
      try {
        const { data: statusData } = await supabase.functions.invoke(
          "google-oauth",
          { body: { action: "check-status", integration: id } }
        );

        if (statusData) {
          setIntegrations((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: statusData.status,
                    error: statusData.error,
                    lastSync: statusData.status === "connected" ? new Date().toLocaleTimeString() : undefined,
                  }
                : i
            )
          );
        }
      } catch (err) {
        console.log(`${id} check skipped:`, err);
      }
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
    } catch (err) {
      console.log("RingCentral check skipped:", err);
    }
  }, []);

  const startOAuth = useCallback(async (integrationId: string) => {
    // Open popup immediately to avoid browser blocking
    // (browsers block popups opened after async calls)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      "about:blank",
      "Google OAuth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for this site and try again",
        variant: "destructive",
      });
      return;
    }

    // Show loading state in popup
    popup.document.write(`
      <html>
        <head><title>Connecting...</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;background:#0a0a0a;color:#fff;">
          <div style="text-align:center;">
            <div style="margin-bottom:16px;">Connecting to Google...</div>
            <div style="width:32px;height:32px;border:3px solid #333;border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div>
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </body>
      </html>
    `);

    try {
      const redirectUri = `${window.location.origin}/integrations/callback`;
      
      const { data, error } = await supabase.functions.invoke(
        "google-oauth",
        {
          body: {
            action: "get-auth-url",
            integration: integrationId,
            redirectUri,
          },
        }
      );

      if (error) throw new Error(error.message);

      // Navigate popup to OAuth URL
      popup.location.href = data.authUrl;
    } catch (error) {
      popup.close();
      const message = error instanceof Error ? error.message : "Failed to start OAuth";
      toast({ title: "OAuth Error", description: message, variant: "destructive" });
    }
  }, [toast]);

  return {
    integrations,
    loading,
    testing,
    checkIntegrationStatus,
    checkAllStatuses,
    startOAuth,
    refreshStatuses: loadIntegrationStatuses,
  };
}
