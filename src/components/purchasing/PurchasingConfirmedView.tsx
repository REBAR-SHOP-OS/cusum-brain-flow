import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConfirmedListRecord } from "@/hooks/usePurchasingDates";

interface PurchasingConfirmedViewProps {
  record: ConfirmedListRecord;
}

export function PurchasingConfirmedView({ record }: PurchasingConfirmedViewProps) {
  const snapshot = (record.snapshot || []) as Array<{
    title: string;
    category: string | null;
    quantity: number;
    status: "purchased" | "rejected" | "pending";
    priority: string;
  }>;

  const purchased = snapshot.filter((i) => i.status === "purchased");
  const rejected = snapshot.filter((i) => i.status === "rejected");
  const pending = snapshot.filter((i) => i.status === "pending");

  // Group by category
  const categories = [...new Set(snapshot.map((i) => i.category || "Other"))];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Confirmed List</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>📅 {record.due_date}</span>
          <span>🕐 {format(new Date(record.confirmed_at), "yyyy/MM/dd HH:mm")}</span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3.5 h-3.5" /> {purchased.length} purchased
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <XCircle className="w-3.5 h-3.5" /> {rejected.length} rejected
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> {pending.length} pending
          </span>
        </div>
      </div>

      {/* Chat-like summary */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {categories.map((cat) => {
          const catItems = snapshot.filter((i) => (i.category || "Other") === cat);
          return (
            <div key={cat} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-3">{cat}</h3>
              <div className="space-y-2">
                {catItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                      item.status === "purchased" && "bg-green-500/10 text-green-700 dark:text-green-400",
                      item.status === "rejected" && "bg-red-500/10 text-red-600 dark:text-red-400",
                      item.status === "pending" && "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {item.status === "purchased" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                    {item.status === "rejected" && <XCircle className="w-4 h-4 flex-shrink-0" />}
                    {item.status === "pending" && <Clock className="w-4 h-4 flex-shrink-0" />}
                    <span className={cn(
                      "flex-1",
                      item.status !== "pending" && "font-medium"
                    )}>
                      {item.title}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-xs opacity-70">×{item.quantity}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {snapshot.length === 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm">
            No items in this snapshot
          </div>
        )}
      </div>
    </div>
  );
}
