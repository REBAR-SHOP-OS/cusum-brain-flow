import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table2, Camera } from "lucide-react";

interface PackingSlipTypeSelectorProps {
  open: boolean;
  onSelect: (type: "standard" | "photo") => void;
  onClose: () => void;
  hasPhotos: boolean;
}

export function PackingSlipTypeSelector({ open, onSelect, onClose, hasPhotos }: PackingSlipTypeSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Packing Slip Type</DialogTitle>
          <DialogDescription>Choose the format for your packing slip</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <button
            onClick={() => onSelect("standard")}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Table2 className="w-10 h-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-semibold text-sm">Standard Table</p>
              <p className="text-xs text-muted-foreground mt-1">Classic tabular format</p>
            </div>
          </button>
          <button
            onClick={() => onSelect("photo")}
            disabled={!hasPhotos}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
          >
            <Camera className="w-10 h-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-semibold text-sm">With Photos</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasPhotos ? "Includes loading evidence" : "No photos available"}
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
