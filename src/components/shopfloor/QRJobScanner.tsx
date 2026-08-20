import { useState } from "react";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import QRCameraScanner from "@/components/camera/QRCameraScanner";

interface QRJobScannerProps {
  /** Current machine ID for context */
  machineId?: string;
}

export function QRJobScanner({ machineId }: QRJobScannerProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleScanned = (data: string) => {
    setOpen(false);
    const trimmed = data.trim();

    // Format 1: just a UUID (cut_plan_item id)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(trimmed)) {
      toast({ title: "QR Scanned", description: `Item ${trimmed.slice(0, 8)}… found` });
      // Navigate to station with item pre-selected via query param
      const base = machineId
        ? `/shopfloor/station/${machineId}`
        : "/shopfloor/station";
      navigate(`${base}?item=${trimmed}`);
      return;
    }

    // Format 2: orderId:markNumber
    if (trimmed.includes(":")) {
      const [orderId, markNumber] = trimmed.split(":", 2);
      toast({ title: "QR Scanned", description: `Mark ${markNumber} on order ${orderId.slice(0, 8)}…` });
      const base = machineId
        ? `/shopfloor/station/${machineId}`
        : "/shopfloor/station";
      navigate(`${base}?order=${orderId}&mark=${markNumber}`);
      return;
    }

    toast({ title: "Unknown QR format", description: trimmed.slice(0, 60), variant: "destructive" });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs rounded-full border-border"
        onClick={() => setOpen(true)}
      >
        <QrCode className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Scan QR</span>
      </Button>
      <QRCameraScanner open={open} onOpenChange={setOpen} onScanned={handleScanned} />
    </>
  );
}
