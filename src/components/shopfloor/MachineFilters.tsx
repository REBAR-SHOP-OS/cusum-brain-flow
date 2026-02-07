import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MachineType, MachineStatus } from "@/types/machine";

interface MachineFiltersProps {
  warehouses: string[];
  typeFilter: string;
  statusFilter: string;
  warehouseFilter: string;
  onTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
}

const typeOptions: { value: MachineType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "cutter", label: "Cutter" },
  { value: "bender", label: "Bender" },
  { value: "loader", label: "Loader" },
  { value: "other", label: "Other" },
];

const statusOptions: { value: MachineStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "idle", label: "Idle" },
  { value: "running", label: "Running" },
  { value: "blocked", label: "Blocked" },
  { value: "down", label: "Down" },
];

export function MachineFilters({
  warehouses,
  typeFilter,
  statusFilter,
  warehouseFilter,
  onTypeChange,
  onStatusChange,
  onWarehouseChange,
}: MachineFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select value={typeFilter} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {typeOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {warehouses.length > 0 && (
        <Select value={warehouseFilter} onValueChange={onWarehouseChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
