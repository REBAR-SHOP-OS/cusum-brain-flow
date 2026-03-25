import { Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PurchasingItem } from "@/hooks/usePurchasingList";

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-green-500",
};

export interface DefaultItem {
  title: string;
  category: "Office" | "Workshop";
}

export const COMPANY_DEFAULTS: DefaultItem[] = [
  // Office
  { title: "Paper Towels", category: "Office" },
  { title: "Coffee", category: "Office" },
  { title: "Tea", category: "Office" },
  { title: "Cups", category: "Office" },
  { title: "Milk", category: "Office" },
  { title: "Paper", category: "Office" },
  { title: "Garbage Bags", category: "Office" },
  { title: "Snacks", category: "Office" },
  { title: "AA Batteries", category: "Office" },
  { title: "AAA Batteries", category: "Office" },
  { title: "Stationery (pens, pencils, markers, etc.)", category: "Office" },
  { title: "Bottled Water (for Espresso Machine)", category: "Office" },
  { title: "Plates", category: "Office" },
  { title: "Spoons", category: "Office" },
  { title: "Forks", category: "Office" },
  // Workshop
  { title: "Coffee", category: "Workshop" },
  { title: "Tea", category: "Workshop" },
  { title: "Water for Coffee Machine", category: "Workshop" },
  { title: "Small Drinking Cups", category: "Workshop" },
  { title: "Small Coffee Cups", category: "Workshop" },
  { title: "Plates", category: "Workshop" },
  { title: "Spoons", category: "Workshop" },
  { title: "Powdered Milk", category: "Workshop" },
  { title: "Sugar", category: "Workshop" },
  { title: "Thin Wire (for packaging)", category: "Workshop" },
  { title: "Forklift Oil Filter", category: "Workshop" },
  { title: "Forklift Oil", category: "Workshop" },
  { title: "Forklift Air Filter", category: "Workshop" },
  { title: "Grease (for grease pump)", category: "Workshop" },
  { title: "Gasoline", category: "Workshop" },
  { title: "Salt (for entrance / winter use)", category: "Workshop" },
  { title: "Paint for Sawhorses", category: "Workshop" },
  { title: "Orange Paint (for Stirrup Machine)", category: "Workshop" },
  { title: "220V Switch for Welding Machine", category: "Workshop" },
  { title: "220V Outlet for Welding Machine", category: "Workshop" },
  { title: "Straps for Fire Extinguisher Pallets", category: "Workshop" },
  { title: "Winter Gloves", category: "Workshop" },
  { title: "Thick Black Markers", category: "Workshop" },
  { title: "Rebar Tie Wire (for tying gun)", category: "Workshop" },
  { title: "Forklift Snow Chains", category: "Workshop" },
];

interface CompanyDefaultItemsProps {
  dbItems: PurchasingItem[];
  customItems?: PurchasingItem[];
  disabled?: boolean;
  onMarkPurchased: (title: string, category: string) => void;
  onUnmarkPurchased: (itemId: string) => void;
  onMarkRejected: (title: string, category: string) => void;
  onUnmarkRejected: (itemId: string) => void;
  onTogglePurchased?: (itemId: string, current: boolean) => void;
  onToggleRejected?: (itemId: string, current: boolean) => void;
  onDeleteItem?: (itemId: string) => void;
}

function findDbMatch(def: DefaultItem, dbItems: PurchasingItem[]): PurchasingItem | undefined {
  return dbItems.find(
    (i) => i.title === def.title && i.category === def.category
  );
}

function DefaultRow({
  def,
  dbMatch,
  onMarkPurchased,
  onMarkRejected,
  onTogglePurchased,
  onToggleRejected,
  onDeleteItem,
}: {
  def: DefaultItem;
  dbMatch: PurchasingItem | undefined;
  onMarkPurchased: (title: string, category: string) => void;
  onMarkRejected: (title: string, category: string) => void;
  onTogglePurchased?: (itemId: string, current: boolean) => void;
  onToggleRejected?: (itemId: string, current: boolean) => void;
  onDeleteItem?: (itemId: string) => void;
}) {
  const isPurchased = dbMatch?.is_purchased ?? false;
  const isRejected = dbMatch?.is_rejected ?? false;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors",
        isPurchased && "bg-green-500/20 border-green-500/50",
        isRejected && "bg-red-500/20 border-red-500/50"
      )}
    >
      {/* Approve button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-full",
          isPurchased
            ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
            : "text-muted-foreground hover:text-green-500"
        )}
        onClick={() => {
          if (dbMatch) {
            onTogglePurchased?.(dbMatch.id, isPurchased);
          } else {
            onMarkPurchased(def.title, def.category);
          }
        }}
      >
        <Check className="w-3.5 h-3.5" />
      </Button>
      {/* Reject button */}
      {isPurchased && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (dbMatch) {
              onTogglePurchased?.(dbMatch.id, true);
            }
          }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
      <span className={cn(
        "flex-1 text-sm font-medium",
        isPurchased && "line-through text-green-600",
        isRejected && "line-through text-red-500"
      )}>
        {def.title}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => {
          if (dbMatch) {
            onToggleRejected?.(dbMatch.id, false);
          } else {
            onMarkRejected(def.title, def.category);
          }
        }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export function CompanyDefaultItems({ dbItems, customItems = [], disabled, onMarkPurchased, onUnmarkPurchased, onMarkRejected, onUnmarkRejected, onTogglePurchased, onToggleRejected, onDeleteItem }: CompanyDefaultItemsProps) {
  const officeItems = COMPANY_DEFAULTS.filter((d) => d.category === "Office");
  const workshopItems = COMPANY_DEFAULTS.filter((d) => d.category === "Workshop");

  const renderCustomRow = (item: PurchasingItem) => (
    <div
      key={item.id}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors",
        item.is_purchased && "bg-green-500/20 border-green-500/50",
        item.is_rejected && "bg-red-500/20 border-red-500/50"
      )}
    >
      <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-full", item.is_purchased ? "bg-green-500/20 text-green-500 hover:bg-green-500/30" : "text-muted-foreground hover:text-green-500")} onClick={() => onTogglePurchased?.(item.id, item.is_purchased)}>
        <Check className="w-3.5 h-3.5" />
      </Button>
      {item.is_purchased && (
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" onClick={() => onTogglePurchased?.(item.id, true)}>
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium text-sm", item.is_purchased && "line-through text-green-600", item.is_rejected && "line-through text-red-500")}>{item.title}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>×{item.quantity}</span>
          {item.due_date && <span>{item.due_date}</span>}
        </div>
      </div>
      <span className={cn("text-xs font-medium", PRIORITY_COLORS[item.priority] || "text-muted-foreground")}>
        {item.priority === "high" ? "Urgent" : item.priority === "low" ? "Low" : "Normal"}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDeleteItem?.(item.id)}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  const renderGroup = (label: string, items: DefaultItem[]) => {
    const groupCustom = customItems.filter(i => i.category === label);
    // Filter out rejected default items (they should be hidden)
    const visibleItems = items.filter((def) => {
      const match = findDbMatch(def, dbItems);
      return !match?.is_rejected;
    });
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2 pb-1">
          {label}
        </h3>
        {visibleItems.map((def, i) => (
          <DefaultRow
            key={`${def.category}-${i}`}
            def={def}
            dbMatch={findDbMatch(def, dbItems)}
            onMarkPurchased={onMarkPurchased}
            onMarkRejected={onMarkRejected}
            onTogglePurchased={onTogglePurchased}
            onToggleRejected={onToggleRejected}
            onDeleteItem={onDeleteItem}
          />
        ))}
        {groupCustom.map(item => renderCustomRow(item))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {renderGroup("Office", officeItems)}
      {renderGroup("Workshop", workshopItems)}
    </div>
  );
}
