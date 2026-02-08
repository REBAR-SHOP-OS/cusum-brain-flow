import { ExternalLink, Shield, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { IntegrationIcon } from "./IntegrationIcons";
import type { Integration } from "./IntegrationCard";
import brandLogo from "@/assets/brand-logo.png";

interface ConnectDialogProps {
  integration: Integration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (integrationId: string) => void;
  connecting?: boolean;
}

export function ConnectDialog({
  integration,
  open,
  onOpenChange,
  onConnect,
  connecting,
}: ConnectDialogProps) {
  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 rounded-2xl overflow-hidden border-border">
        {/* Header with icons */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <IntegrationIcon id={integration.id} className="w-8 h-8" />
            </div>
            <span className="text-muted-foreground text-lg">⇄</span>
            <img
              src={brandLogo}
              alt="App"
              className="w-12 h-12 rounded-xl object-contain"
            />
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground text-center">
            Connect {integration.name}
          </DialogTitle>
        </div>

        {/* Info items */}
        <div className="px-6 pb-6 space-y-5">
          <div className="flex gap-3">
            <ExternalLink className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Authentication will open in a new tab
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click Connect below, then authenticate and accept terms in the new tab
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Integration permissions are strictly respected
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your connected account is managed through a verified and trusted connection
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Eye className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                We do not train models on your data
              </p>
            </div>
          </div>

          <Button
            className="w-full rounded-full mt-2"
            size="lg"
            onClick={() => onConnect(integration.id)}
            disabled={connecting}
          >
            {connecting ? "Connecting..." : `Connect ${integration.name}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
