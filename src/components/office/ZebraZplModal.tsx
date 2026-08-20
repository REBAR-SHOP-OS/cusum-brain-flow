import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check, Printer } from "lucide-react";
import { toast } from "sonner";

interface ZebraZplModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zpl: string;
  labelCount: number;
  sessionName: string;
}

export function ZebraZplModal({
  open,
  onOpenChange,
  zpl,
  labelCount,
  sessionName,
}: ZebraZplModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(zpl);
    setCopied(true);
    toast.success("ZPL copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([zpl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionName || "tags-export"}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
            <Printer className="w-4 h-4 text-primary" />
            Zebra ZT411 — ZPL Output
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          4×6 in · 203 DPI · {labelCount} label{labelCount !== 1 ? "s" : ""}
        </p>

        <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-border bg-muted/30">
          <pre className="h-full overflow-auto p-4 text-[11px] leading-5 font-mono text-foreground whitespace-pre">
            {zpl}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleCopy}>
            {copied ? (
              <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy ZPL</>
            )}
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" /> Download .zpl
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
