import { useState, useRef } from "react";
import { format } from "date-fns";
import { CalendarIcon, Package, Check, X, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generatePdf } from "@/components/purchasing/PurchasingConfirmedView";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/accounting/ConfirmActionDialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePurchasingList } from "@/hooks/usePurchasingList";
import { CompanyDefaultItems, COMPANY_DEFAULTS } from "./CompanyDefaultItems";

const STATUS_TABS = [
  { value: "all" as const, label: "All" },
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
  defaultFilterStatus?: "all" | "purchased";
}

export function PurchasingListPanel({ filterDate: externalDate, onFilterDateChange, defaultFilterStatus = "all" }: PurchasingListPanelProps = {}) {
  const [internalDate, setInternalDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const filterDate = externalDate !== undefined ? externalDate : internalDate;
  const setFilterDate = onFilterDateChange || setInternalDate;
  const [filterStatus, setFilterStatus] = useState<"all" | "purchased">(defaultFilterStatus);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("medium");

  const { items, loading, addItem, addItemAsPurchased, addItemAsRejected, togglePurchased, toggleRejected, deleteItem, confirmList, refetch } = usePurchasingList(filterDate, filterStatus);

  const customItems = items.filter(item =>
    !COMPANY_DEFAULTS.some(d => d.title === item.title && d.category === item.category)
  );
  const categorizedCustom = customItems.filter(i => i.category === "Office" || i.category === "Workshop");
  const otherCustom = customItems.filter(i => i.category !== "Office" && i.category !== "Workshop");

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const success = await addItem(newTitle.trim(), parseInt(newQty) || 1, newCategory || undefined, newPriority, filterDate ? format(filterDate, "yyyy-MM-dd") : undefined);
    if (success === false) {
      toast.error("Failed to add item – check console for details");
      return;
    }
    setNewTitle("");
    setNewQty("1");
    setNewCategory("");
    setNewPriority("medium");
    await refetch();
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full border-2 border-green-500/40 bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-600 hover:border-green-500/60"
                  onClick={() => {
                    if (!filterDate) {
                      setFilterDate(new Date());
                    }
                    setConfirmDialogOpen(true);
                  }}
                >
                  <CheckCircle className="w-7 h-7" strokeWidth={2.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Confirm & Save List</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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

      {/* Always-visible Add form */}
      <div className="p-3 border-b border-border bg-muted/30 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Item name..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
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
          <Button onClick={handleAdd} disabled={!newTitle.trim() || !newCategory}>Add</Button>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Company Defaults */}
        <CompanyDefaultItems
          dbItems={items}
          customItems={categorizedCustom}
          onMarkPurchased={(title, category) => addItemAsPurchased(title, category, filterDate ? format(filterDate, "yyyy-MM-dd") : undefined)}
          onUnmarkPurchased={(itemId) => togglePurchased(itemId, true)}
          onMarkRejected={(title, category) => addItemAsRejected(title, category, filterDate ? format(filterDate, "yyyy-MM-dd") : undefined)}
          onUnmarkRejected={(itemId) => toggleRejected(itemId, true)}
          onTogglePurchased={(itemId, current) => togglePurchased(itemId, current)}
          onToggleRejected={(itemId, current) => toggleRejected(itemId, current)}
          onDeleteItem={(itemId) => deleteItem(itemId)}
        />

        <div className="border-t border-border my-2" />

        {/* Custom Items */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : otherCustom.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 text-sm">No custom items</div>
        ) : (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2 pb-1">Custom Items</h3>
            {otherCustom.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors",
                  item.is_purchased && "bg-green-500/20 border-green-500/50",
                  item.is_rejected && "bg-red-500/20 border-red-500/50"
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-muted-foreground hover:text-red-500"
                  onClick={() => deleteItem(item.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "font-medium",
                    item.is_purchased && "line-through text-green-600",
                    item.is_rejected && "line-through text-red-500"
                  )}>
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
            ))}
          </>
        )}
      </div>

      {/* Confirm button — always visible */}
      <div className="p-3 border-t border-border">
        <Button
          className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => {
            if (!filterDate) {
              toast.error("Please select a date first");
              return;
            }
            setConfirmDialogOpen(true);
          }}
        >
          <CheckCircle className="w-4 h-4" />
          Confirm & Save
        </Button>
      </div>

      {/* Confirmation dialog */}
      <ConfirmActionDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Confirm Purchasing List"
        description={`Save all items for ${filterDate ? format(filterDate, "yyyy/MM/dd") : format(new Date(), "yyyy/MM/dd")}?`}
        details={[
          `Total items: ${items.length}`,
          `Pending (no date): ${items.filter(i => !i.due_date).length}`,
          `Date: ${filterDate ? format(filterDate, "yyyy/MM/dd") : format(new Date(), "yyyy/MM/dd")}`,
        ]}
        confirmLabel="Yes, Confirm & Save"
        loading={confirmLoading}
        onConfirm={async () => {
          const effectiveDate = filterDate ?? new Date();
          setConfirmLoading(true);
          const dateStr = format(effectiveDate, "yyyy-MM-dd");
          const result = await confirmList(dateStr);
          if (result) {
            await generatePdf(
              { due_date: result.due_date, confirmed_at: result.confirmed_at } as any,
              result.snapshot
            );
          }
          await refetch();
          setConfirmLoading(false);
          setConfirmDialogOpen(false);
        }}
      />
    </div>
  );
}
