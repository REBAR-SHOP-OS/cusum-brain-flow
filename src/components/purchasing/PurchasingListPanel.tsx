import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, Package, Check, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePurchasingList } from "@/hooks/usePurchasingList";
import { CompanyDefaultItems } from "./CompanyDefaultItems";

const STATUS_TABS = [
  { value: "all" as const, label: "All" },
  { value: "pending" as const, label: "Not Purchased" },
  { value: "purchased" as const, label: "Purchased" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-green-500",
};

interface PurchasingListPanelProps {
  filterDate?: Date;
  onFilterDateChange?: (date: Date | undefined) => void;
}

export function PurchasingListPanel({ filterDate: externalDate, onFilterDateChange }: PurchasingListPanelProps = {}) {
  const [internalDate, setInternalDate] = useState<Date | undefined>();
  const filterDate = externalDate !== undefined ? externalDate : internalDate;
  const setFilterDate = onFilterDateChange || setInternalDate;
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "purchased">("all");
  const [newTitle, setNewTitle] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [showAddForm, setShowAddForm] = useState(false);

  const { items, loading, addItem, addItemAsPurchased, togglePurchased, deleteItem } = usePurchasingList(filterDate, filterStatus);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addItem(newTitle.trim(), parseInt(newQty) || 1, newCategory || undefined, newPriority, filterDate ? format(filterDate, "yyyy-MM-dd") : undefined);
    setNewTitle("");
    setNewQty("1");
    setNewCategory("");
    setNewPriority("medium");
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Company Purchasing List</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Calendar filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1", filterDate && "text-primary")}>
                <CalendarIcon className="w-4 h-4" />
                {filterDate ? format(filterDate, "yyyy/MM/dd") : "Calendar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={filterDate}
                onSelect={(d) => setFilterDate(d || undefined)}
                className="p-3 pointer-events-auto"
              />
              {filterDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilterDate(undefined)}>
                    Clear Filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="gap-1">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-2 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={filterStatus === tab.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilterStatus(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-3 border-b border-border bg-muted/30 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Item name..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <Input
              type="number"
              placeholder="Qty"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-20"
              min={1}
            />
          </div>
          <div className="flex gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Office">Office</SelectItem>
                <SelectItem value="Workshop">Workshop</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Urgent</SelectItem>
                <SelectItem value="medium">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!newTitle.trim()}>Add</Button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Company Defaults */}
        <CompanyDefaultItems
          dbItems={items}
          onMarkPurchased={(title, category) => addItemAsPurchased(title, category, filterDate ? format(filterDate, "yyyy-MM-dd") : undefined)}
          onUnmarkPurchased={(itemId) => togglePurchased(itemId, true)}
        />

        <div className="border-t border-border my-2" />

        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 text-sm">No additional items</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors",
                item.is_purchased && "opacity-60"
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-full",
                  item.is_purchased
                    ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                    : "text-muted-foreground hover:text-green-500"
                )}
                onClick={() => togglePurchased(item.id, item.is_purchased)}
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className={cn("font-medium", item.is_purchased && "line-through text-muted-foreground")}>
                  {item.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>×{item.quantity}</span>
                  {item.category && <span className="bg-muted px-1.5 py-0.5 rounded">{item.category}</span>}
                  {item.due_date && <span>{item.due_date}</span>}
                </div>
              </div>
              <span className={cn("text-xs font-medium", PRIORITY_COLORS[item.priority] || "text-muted-foreground")}>
                {item.priority === "high" ? "Urgent" : item.priority === "low" ? "Low" : "Normal"}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteItem(item.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
