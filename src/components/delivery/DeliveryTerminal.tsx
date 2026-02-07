import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/shopfloor/SignaturePad";
import { Camera, Navigation, Check, Package } from "lucide-react";

interface DeliveryTerminalProps {
  deliveryId: string;
  address: string;
  category?: string;
  items: { id: string; label: string; checked: boolean }[];
  onToggleItem: (id: string) => void;
  onCapture: (photoData: string) => void;
  onSign: (signatureData: string) => void;
  onComplete: () => void;
  canWrite: boolean;
}

export function DeliveryTerminal({
  deliveryId,
  address,
  category = "DELIVERY",
  items,
  onToggleItem,
  onCapture,
  onSign,
  onComplete,
  canWrite,
}: DeliveryTerminalProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allChecked = items.length > 0 && items.every((i) => i.checked);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhoto(result);
      onCapture(result);
    };
    reader.readAsDataURL(file);
  };

  const handleLaunchNav = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs mb-1">
              {category}
            </Badge>
            <h1 className="text-lg font-bold tracking-wide uppercase">
              Jobsite Delivery Terminal
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-sm text-muted-foreground flex-1">{address}</p>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleLaunchNav}>
            <Navigation className="w-3 h-3" />
            Launch Nav
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* Site drop photo */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground tracking-wider uppercase font-semibold">
            Site Drop Photo
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoCapture}
          />
          {photo ? (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img src={photo} alt="Site drop" className="w-full h-48 object-cover" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-2 right-2"
                onClick={() => fileInputRef.current?.click()}
              >
                Retake
              </Button>
            </div>
          ) : (
            <div
              className="h-48 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tap to Capture</span>
            </div>
          )}
        </div>

        {/* Customer sign-off */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground tracking-wider uppercase font-semibold">
            Customer Sign-Off
          </p>
          <SignaturePad
            onSignatureChange={(data) => {
              setSignature(data);
              if (data) onSign(data);
            }}
          />
        </div>

        {/* Unloading checklist */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground tracking-wider uppercase font-semibold">
            Unloading Checklist
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer transition-colors ${
                  item.checked
                    ? "border-success/30 bg-success/5"
                    : "hover:border-primary/30"
                }`}
                onClick={() => canWrite && onToggleItem(item.id)}
              >
                <CardContent className="p-3 flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border ${
                      item.checked
                        ? "bg-success border-success text-success-foreground"
                        : "border-border"
                    }`}
                  >
                    {item.checked && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-sm font-mono">{item.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 bg-card">
        <Button
          className="w-full gap-2 font-bold"
          size="lg"
          disabled={!canWrite || !allChecked || !photo || !signature}
          onClick={onComplete}
        >
          <Package className="w-5 h-5" />
          Complete Delivery
        </Button>
      </div>
    </div>
  );
}
