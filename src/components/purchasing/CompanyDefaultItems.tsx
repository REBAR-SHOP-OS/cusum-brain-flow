import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PurchasingItem } from "@/hooks/usePurchasingList";

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
  onMarkPurchased: (title: string, category: string) => void;
  onUnmarkPurchased: (itemId: string) => void;
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
  onUnmarkPurchased,
}: {
  def: DefaultItem;
  dbMatch: PurchasingItem | undefined;
  onMarkPurchased: (title: string, category: string) => void;
  onUnmarkPurchased: (itemId: string) => void;
}) {
  const isPurchased = dbMatch?.is_purchased ?? false;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors",
        isPurchased && "opacity-60"
      )}
    >
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
          if (isPurchased && dbMatch) {
            onUnmarkPurchased(dbMatch.id);
          } else if (!isPurchased) {
            onMarkPurchased(def.title, def.category);
          }
        }}
      >
        <Check className="w-3.5 h-3.5" />
      </Button>
      <span className={cn("flex-1 text-sm font-medium", isPurchased && "line-through text-muted-foreground")}>
        {def.title}
      </span>
    </div>
  );
}

export function CompanyDefaultItems({ dbItems, onMarkPurchased, onUnmarkPurchased }: CompanyDefaultItemsProps) {
  const officeItems = COMPANY_DEFAULTS.filter((d) => d.category === "Office");
  const workshopItems = COMPANY_DEFAULTS.filter((d) => d.category === "Workshop");

  const renderGroup = (label: string, items: DefaultItem[]) => (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2 pb-1">
        {label}
      </h3>
      {items.map((def, i) => (
        <DefaultRow
          key={`${def.category}-${i}`}
          def={def}
          dbMatch={findDbMatch(def, dbItems)}
          onMarkPurchased={onMarkPurchased}
          onUnmarkPurchased={onUnmarkPurchased}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      {renderGroup("Office", officeItems)}
      {renderGroup("Workshop", workshopItems)}
    </div>
  );
}
