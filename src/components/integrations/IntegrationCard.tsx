import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IntegrationIcon } from "./IntegrationIcons";

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
      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
        <IntegrationIcon id={integration.id} />
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
