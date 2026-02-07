import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Plus } from "lucide-react";
import { RebarSize, MachineCapability } from "@/hooks/useCutPlans";

interface AddItemFormProps {
  rebarSizes: RebarSize[];
  capabilities: MachineCapability[];
  getMaxBars: (barCode: string) => number | null;
  onAdd: (barCode: string, qtyBars: number, cutLengthMm: number, piecesPerBar: number) => void;
}

export function AddItemForm({ rebarSizes, capabilities, getMaxBars, onAdd }: AddItemFormProps) {
  const [barCode, setBarCode] = useState("");
  const [qtyBars, setQtyBars] = useState(1);
  const [cutLengthMm, setCutLengthMm] = useState(6000);
  const [piecesPerBar, setPiecesPerBar] = useState(1);

  const maxAllowed = useMemo(() => {
    if (!barCode) return null;
    return getMaxBars(barCode);
  }, [barCode, getMaxBars]);

  const selectedSize = rebarSizes.find(s => s.bar_code === barCode);
  const capabilityMissing = barCode && maxAllowed === null;
  const overMax = maxAllowed !== null && qtyBars > maxAllowed;

  const handleSubmit = () => {
    if (!barCode || capabilityMissing || overMax || qtyBars < 1 || cutLengthMm < 1) return;
    onAdd(barCode, qtyBars, cutLengthMm, piecesPerBar);
    setBarCode("");
    setQtyBars(1);
    setCutLengthMm(6000);
    setPiecesPerBar(1);
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
      <h4 className="text-sm font-semibold">Add Item</h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Bar Code</Label>
          <Select value={barCode} onValueChange={setBarCode}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {rebarSizes.map(s => (
                <SelectItem key={s.bar_code} value={s.bar_code}>
                  {s.bar_code} — {s.diameter_mm}mm
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Cut Length (mm)</Label>
          <Input
            type="number"
            className="h-9"
            value={cutLengthMm}
            onChange={e => setCutLengthMm(Number(e.target.value))}
            min={1}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            Qty Bars
            {maxAllowed !== null && (
              <span className="text-muted-foreground ml-1">(max {maxAllowed})</span>
            )}
          </Label>
          <Input
            type="number"
            className="h-9"
            value={qtyBars}
            onChange={e => setQtyBars(Number(e.target.value))}
            min={1}
            max={maxAllowed ?? undefined}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Pieces/Bar</Label>
          <Input
            type="number"
            className="h-9"
            value={piecesPerBar}
            onChange={e => setPiecesPerBar(Number(e.target.value))}
            min={1}
          />
        </div>
      </div>

      {selectedSize && (
        <p className="text-xs text-muted-foreground">
          {selectedSize.bar_code}: ⌀{selectedSize.diameter_mm}mm • {selectedSize.mass_kg_per_m} kg/m • {selectedSize.area_mm2} mm²
        </p>
      )}

      {capabilityMissing && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            No cutting capability found for <strong>{barCode}</strong> on GENSCO DTX 400. Add it in Admin → Machines first.
          </AlertDescription>
        </Alert>
      )}

      {overMax && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            Qty {qtyBars} exceeds max allowed ({maxAllowed}) for {barCode} on DTX 400.
          </AlertDescription>
        </Alert>
      )}

      <Button
        size="sm"
        className="gap-1"
        onClick={handleSubmit}
        disabled={!barCode || !!capabilityMissing || !!overMax || qtyBars < 1 || cutLengthMm < 1}
      >
        <Plus className="w-3.5 h-3.5" /> Add Item
      </Button>
    </div>
  );
}
