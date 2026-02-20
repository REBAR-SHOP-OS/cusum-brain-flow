import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface EstimationItem {
  id: string;
  element_type: string;
  element_ref: string;
  mark: string;
  bar_size: string;
  quantity: number;
  cut_length_mm: number;
  total_length_mm: number;
  hook_allowance_mm: number;
  lap_allowance_mm: number;
  weight_kg: number;
  unit_cost: number;
  line_cost: number;
  warnings: string[];
}

interface BOMTableProps {
  items: EstimationItem[];
  onItemUpdated: () => void;
}

export default function BOMTable({ items, onItemUpdated }: BOMTableProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (id: string, field: string, value: any) => {
    setEditingCell({ id, field });
    setEditValue(String(value ?? ""));
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const numericFields = ["quantity", "cut_length_mm"];
    const val = numericFields.includes(field) ? Number(editValue) : editValue;

    const { error } = await supabase
      .from("estimation_items")
      .update({ [field]: val })
      .eq("id", id);

    if (error) {
      toast.error("Update failed");
    } else {
      toast.success("Updated");
      onItemUpdated();
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditingCell(null);
  };

  const renderCell = (item: EstimationItem, field: string, value: any, align = "left") => {
    const isEditing = editingCell?.id === item.id && editingCell?.field === field;
    const editable = ["quantity", "cut_length_mm", "bar_size", "mark"].includes(field);

    if (isEditing) {
      return (
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="h-7 w-20 text-xs"
        />
      );
    }

    return (
      <span
        className={`${editable ? "cursor-pointer hover:bg-primary/10 px-1 rounded" : ""} ${align === "right" ? "text-right block" : ""}`}
        onDoubleClick={() => editable && startEdit(item.id, field, value)}
      >
        {value}
      </span>
    );
  };

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Element</TableHead>
            <TableHead>Ref</TableHead>
            <TableHead>Mark</TableHead>
            <TableHead>Bar Size</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Cut (mm)</TableHead>
            <TableHead className="text-right">Total (mm)</TableHead>
            <TableHead className="text-right">Hook</TableHead>
            <TableHead className="text-right">Lap</TableHead>
            <TableHead className="text-right">Weight (kg)</TableHead>
            <TableHead className="text-right">Unit $</TableHead>
            <TableHead className="text-right">Line $</TableHead>
            <TableHead>⚠</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="text-sm">
              <TableCell className="capitalize">{item.element_type}</TableCell>
              <TableCell>{item.element_ref}</TableCell>
              <TableCell>{renderCell(item, "mark", item.mark)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {renderCell(item, "bar_size", item.bar_size)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{renderCell(item, "quantity", item.quantity, "right")}</TableCell>
              <TableCell className="text-right">{renderCell(item, "cut_length_mm", item.cut_length_mm?.toLocaleString(), "right")}</TableCell>
              <TableCell className="text-right">{item.total_length_mm?.toLocaleString()}</TableCell>
              <TableCell className="text-right">{item.hook_allowance_mm}</TableCell>
              <TableCell className="text-right">{item.lap_allowance_mm}</TableCell>
              <TableCell className="text-right">{item.weight_kg?.toFixed(2)}</TableCell>
              <TableCell className="text-right">${item.unit_cost?.toFixed(2)}</TableCell>
              <TableCell className="text-right">${item.line_cost?.toFixed(2)}</TableCell>
              <TableCell>
                {(item.warnings?.length ?? 0) > 0 && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground p-3">Double-click a cell to edit. Press Enter to save.</p>
    </div>
  );
}
