import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "available" | "coming";
  icon: string;
}

const integrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Email sync & threading",
    status: "connected",
    icon: "📧",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Accounting & invoicing",
    status: "connected",
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
    status: "available",
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

function IntegrationCard({ integration }: { integration: Integration }) {
  const isConnected = integration.status === "connected";
  const isAvailable = integration.status === "available";

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-colors",
        isConnected
          ? "bg-card border-success/30"
          : "bg-card border-border hover:border-primary/50"
      )}
    >
      <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-2xl">
        {integration.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{integration.name}</h3>
          {isConnected && (
            <CheckCircle2 className="w-4 h-4 text-success" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{integration.description}</p>
      </div>

      {isConnected ? (
        <Button variant="outline" size="sm">
          Settings
        </Button>
      ) : isAvailable ? (
        <Button size="sm">
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
  const connected = integrations.filter((i) => i.status === "connected");
  const available = integrations.filter((i) => i.status !== "connected");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">Connect your tools</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-8">
        {/* Connected */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <h2 className="text-sm font-medium text-muted-foreground">
              CONNECTED ({connected.length})
            </h2>
          </div>
          <div className="space-y-3">
            {connected.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>

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
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
