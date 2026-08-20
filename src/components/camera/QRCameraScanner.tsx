import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanned: (uid: string) => void;
}

export default function QRCameraScanner({ open, onOpenChange, onScanned }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const containerId = "qr-reader";

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setStarting(true);

    // Small delay so the DOM element is mounted
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Extract UID — Reolink QR typically just contains the UID string
            const uid = decodedText.trim();
            if (uid) {
              onScanned(uid);
              onOpenChange(false);
            }
          },
          () => { /* ignore scan failures */ },
        );
        setStarting(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Camera access denied");
          setStarting(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ScanLine className="w-4 h-4 text-primary" />
            Scan Camera QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div
            id={containerId}
            className="w-full max-w-[320px] min-h-[280px] rounded-md overflow-hidden bg-muted"
          />
          {starting && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Starting camera…
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <p className="text-[10px] text-muted-foreground text-center">
            Point at the QR code on your camera to auto-fill the Camera ID.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
