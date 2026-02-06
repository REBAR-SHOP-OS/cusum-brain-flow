import { CheckCircle2, Loader2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface IntegrationField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder: string;
  helpText?: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "error" | "available";
  icon: string;
  lastSync?: string;
  error?: string;
  fields: IntegrationField[];
  docsUrl?: string;
}

interface IntegrationCardProps {
  integration: Integration;
  onClick: () => void;
  testing?: boolean;
}

// Inline SVG icons for integrations that couldn't be downloaded
function RingCentralIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <circle cx="12" cy="12" r="10" fill="#FF8200" />
      <path d="M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z" fill="white" />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4" />
      <path d="M2 8l10 6 10-6" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function IntegrationIcon({ icon, name }: { icon: string; name: string }) {
  // Handle special cases for inline SVG icons
  if (icon === "ringcentral") {
    return <RingCentralIcon />;
  }
  if (icon === "outlook") {
    return <OutlookIcon />;
  }

  // For imported image assets
  return (
    <img 
      src={icon} 
      alt={`${name} logo`} 
      className="w-8 h-8 object-contain"
    />
  );
}

export function IntegrationCard({ integration, onClick, testing }: IntegrationCardProps) {
  const isConnected = integration.status === "connected";
  const isError = integration.status === "error";

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border bg-card transition-all cursor-pointer hover:shadow-md",
        isConnected && "border-success/20",
        isError && "border-destructive/30",
        !isConnected && !isError && "border-border hover:border-primary/30"
      )}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-secondary/30 flex items-center justify-center shrink-0">
        <IntegrationIcon icon={integration.icon} name={integration.name} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground">{integration.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {integration.description}
        </p>
      </div>

      {/* Status Badge */}
      <div className="shrink-0">
        {testing ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
            Connected
            <CheckCircle2 className="w-4 h-4" />
          </div>
        ) : isError ? (
          <Button
            size="sm"
            variant="destructive"
            className="rounded-full px-4"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            Reconnect
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-full px-4 bg-primary hover:bg-primary/90"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
