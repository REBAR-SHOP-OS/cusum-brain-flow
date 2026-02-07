import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SignaturePad } from "./SignaturePad";
import { Check, ShieldCheck, ArrowLeft } from "lucide-react";
import type { PickupOrder, PickupOrderItem } from "@/hooks/usePickupOrders";

interface PickupVerificationProps {
  order: PickupOrder;
  items: PickupOrderItem[];
  onToggleVerified: (itemId: string, verified: boolean) => void;
  onAuthorize: (signatureData: string) => void;
  onBack: () => void;
  canWrite: boolean;
}

export function PickupVerification({
  order,
  items,
  onToggleVerified,
  onAuthorize,
  onBack,
  canWrite,
}: PickupVerificationProps) {
  const [signature, setSignature] = useState<string | null>(null);
  const allVerified = items.length > 0 && items.every((i) => i.verified);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <p className="font-semibold text-sm uppercase tracking-wide">{order.site_address}</p>
          <p className="text-xs text-muted-foreground">Identity Verification Station</p>
        </div>
        {order.customer && (
          <Badge variant="outline" className="text-xs">
            {order.customer.company_name || order.customer.name}
          </Badge>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Handover Manifest */}
        <div className="flex-1 border-r border-border p-4">
          <p className="text-xs text-muted-foreground tracking-wider uppercase font-semibold mb-3">
            Handover Manifest
          </p>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="space-y-2 pr-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    item.verified
                      ? "border-success/30 bg-success/5"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  }`}
                  onClick={() => canWrite && onToggleVerified(item.id, !item.verified)}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center border ${
                      item.verified
                        ? "bg-success border-success text-success-foreground"
                        : "border-border"
                    }`}
                  >
                    {item.verified && <Check className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-mono font-semibold">{item.mark_number}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Collection Authentication */}
        <div className="w-80 lg:w-96 p-4 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground tracking-wider uppercase font-semibold">
            Collection Authentication
          </p>

          <SignaturePad
            onSignatureChange={setSignature}
            className="flex-1"
          />

          <Button
            size="lg"
            className="w-full gap-2 font-bold bg-warning text-warning-foreground hover:bg-warning/90"
            disabled={!canWrite || !signature || !allVerified}
            onClick={() => signature && onAuthorize(signature)}
          >
            <ShieldCheck className="w-5 h-5" />
            Authorize Release
          </Button>

          {!allVerified && (
            <p className="text-xs text-muted-foreground text-center">
              Verify all manifest items before authorizing
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
