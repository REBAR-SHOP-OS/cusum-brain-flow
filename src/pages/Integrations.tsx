import { useState, useEffect } from "react";
import { CheckCircle2, Circle, ExternalLink, RefreshCw, AlertCircle, Settings, Loader2, Key, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "error" | "available" | "coming";
  icon: string;
  lastSync?: string;
  error?: string;
  fields: IntegrationField[];
  docsUrl?: string;
}

interface IntegrationField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder: string;
  helpText?: string;
}

const defaultIntegrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Email sync & threading",
    status: "available",
    icon: "📧",
    docsUrl: "https://developers.google.com/oauthplayground/",
    fields: [
      { key: "GMAIL_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console → Credentials" },
      { key: "GMAIL_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console → Credentials" },
      { key: "GMAIL_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "Get from OAuth Playground with Gmail scopes" },
    ],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Accounting & invoicing",
    status: "available",
    icon: "📊",
    docsUrl: "https://developer.intuit.com/app/developer/homepage",
    fields: [
      { key: "QUICKBOOKS_CLIENT_ID", label: "Client ID", type: "text", placeholder: "ABxxx", helpText: "From Intuit Developer Portal" },
      { key: "QUICKBOOKS_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "xxx", helpText: "From Intuit Developer Portal" },
      { key: "QUICKBOOKS_REALM_ID", label: "Realm ID (Company ID)", type: "text", placeholder: "123456789", helpText: "Your QuickBooks company ID" },
      { key: "QUICKBOOKS_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "AB11xxx", helpText: "From OAuth flow" },
    ],
  },
  {
    id: "ringcentral",
    name: "RingCentral",
    description: "Calls & SMS logging",
    status: "available",
    icon: "📞",
    docsUrl: "https://developers.ringcentral.com/",
    fields: [
      { key: "RINGCENTRAL_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx", helpText: "From RingCentral Developer Portal" },
      { key: "RINGCENTRAL_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "xxx", helpText: "From RingCentral Developer Portal" },
      { key: "RINGCENTRAL_JWT", label: "JWT Token", type: "textarea", placeholder: "eyJxxx", helpText: "JWT credential from RingCentral app" },
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Calendar & scheduling",
    status: "available",
    icon: "📅",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [
      { key: "GOOGLE_CALENDAR_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_CALENDAR_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_CALENDAR_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "From OAuth Playground with Calendar scopes" },
    ],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Document storage",
    status: "available",
    icon: "📁",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [
      { key: "GOOGLE_DRIVE_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_DRIVE_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_DRIVE_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "From OAuth Playground with Drive scopes" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing",
    status: "available",
    icon: "💳",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "Secret Key", type: "password", placeholder: "sk_live_xxx or sk_test_xxx", helpText: "From Stripe Dashboard → Developers → API keys" },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook Secret", type: "password", placeholder: "whsec_xxx", helpText: "From Stripe Dashboard → Developers → Webhooks" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS & Voice",
    status: "available",
    icon: "💬",
    docsUrl: "https://console.twilio.com/",
    fields: [
      { key: "TWILIO_ACCOUNT_SID", label: "Account SID", type: "text", placeholder: "ACxxx", helpText: "From Twilio Console" },
      { key: "TWILIO_AUTH_TOKEN", label: "Auth Token", type: "password", placeholder: "xxx", helpText: "From Twilio Console" },
      { key: "TWILIO_PHONE_NUMBER", label: "Phone Number", type: "text", placeholder: "+1234567890", helpText: "Your Twilio phone number" },
    ],
  },
];

function IntegrationCard({
  integration,
  onTest,
  onClick,
  testing,
}: {
  integration: Integration;
  onTest: () => void;
  onClick: () => void;
  testing: boolean;
}) {
  const isConnected = integration.status === "connected";
  const isError = integration.status === "error";

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer",
        isConnected
          ? "bg-card border-success/30 hover:border-success/50"
          : isError
          ? "bg-card border-destructive/30 hover:border-destructive/50"
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
          <p className="text-xs text-destructive mt-1 truncate">{integration.error}</p>
        )}
      </div>

      {isConnected || isError ? (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={onClick}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline">
          <Key className="w-4 h-4 mr-1" />
          Setup
        </Button>
      )}
    </div>
  );
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [testing, setTesting] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
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
                error: error ? extractErrorMessage(error.message) : undefined,
                lastSync: error ? undefined : new Date().toLocaleTimeString(),
              }
            : i
        )
      );
    } catch (error) {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "gmail" ? { ...i, status: "available" } : i
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
                error: error ? extractErrorMessage(error.message) : undefined,
                lastSync: error ? undefined : new Date().toLocaleTimeString(),
              }
            : i
        )
      );
    } catch (error) {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "ringcentral" ? { ...i, status: "available" } : i
        )
      );
    }
  };

  const extractErrorMessage = (msg: string): string => {
    if (msg.includes("Token has been expired")) return "Token expired - needs refresh";
    if (msg.includes("invalid_grant")) return "Token revoked - needs new token";
    if (msg.includes("not configured")) return "Credentials not configured";
    return msg.slice(0, 50);
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

  const openSetup = (integration: Integration) => {
    setSelectedIntegration(integration);
    setFormValues({});
  };

  const handleSaveCredentials = async () => {
    if (!selectedIntegration) return;
    
    // Check if any fields are filled
    const filledFields = Object.entries(formValues).filter(([_, v]) => v.trim());
    if (filledFields.length === 0) {
      toast({
        title: "No credentials entered",
        description: "Please enter at least one credential",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    // Show instruction to user since we can't save secrets directly
    toast({
      title: "Credentials Ready",
      description: "Please add these secrets in Lovable Cloud → Settings → Secrets",
    });

    // Copy to clipboard for convenience
    const secretsText = filledFields
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    
    try {
      await navigator.clipboard.writeText(secretsText);
      toast({
        title: "Copied to clipboard",
        description: `${filledFields.length} secret(s) copied. Paste in Lovable Cloud Secrets.`,
      });
    } catch {
      // Clipboard not available
    }

    setSaving(false);
    setSelectedIntegration(null);
  };

  const connected = integrations.filter((i) => i.status === "connected" || i.status === "error");
  const available = integrations.filter((i) => i.status === "available" || i.status === "coming");

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
                  onClick={() => openSetup(integration)}
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
                onClick={() => openSetup(integration)}
                testing={testing === integration.id}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Setup Dialog */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedIntegration?.icon}</span>
              {selectedIntegration?.name} Setup
            </DialogTitle>
            <DialogDescription>
              Enter your API credentials to connect {selectedIntegration?.name}.
              {selectedIntegration?.docsUrl && (
                <>
                  {" "}
                  <a
                    href={selectedIntegration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-1"
                  >
                    Get credentials <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {selectedIntegration?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.key}
                    placeholder={field.placeholder}
                    value={formValues[field.key] || ""}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    rows={3}
                    className="font-mono text-xs"
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formValues[field.key] || ""}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="font-mono"
                  />
                )}
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Secrets are stored securely in Lovable Cloud
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedIntegration(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCredentials} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Copy & Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
