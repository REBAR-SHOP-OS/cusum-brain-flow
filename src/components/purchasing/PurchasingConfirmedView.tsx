import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Package, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
const loadJsPDF = () => import("jspdf").then(m => m.jsPDF);
import type { ConfirmedListRecord } from "@/hooks/usePurchasingDates";

interface PurchasingConfirmedViewProps {
  record: ConfirmedListRecord;
}

export type SnapshotItem = {
  title: string;
  category: string | null;
  quantity: number;
  status: "purchased" | "rejected" | "pending";
  priority: string;
};

export async function generatePdf(record: ConfirmedListRecord, snapshot: SnapshotItem[]) {
  const purchased = snapshot.filter(i => i.status === "purchased");
  if (!purchased.length) return;

  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxW = pw - margin * 2;
  let y = margin;

  const checkPage = (needed = 7) => {
    if (y + needed > ph - 15) { doc.addPage(); y = margin; }
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text("Shopping List", margin, y);
  y += 8;

  // Date info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Due: ${record.due_date}    Confirmed: ${format(new Date(record.confirmed_at), "yyyy/MM/dd HH:mm")}`, margin, y);
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Group by category
  const categories = [...new Set(purchased.map(i => i.category || "Other"))];

  for (const cat of categories) {
    const items = purchased.filter(i => (i.category || "Other") === cat);
    checkPage(14);

    // Category header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(cat, margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    for (const item of items) {
      checkPage(6);
      const qty = item.quantity > 1 ? ` ×${item.quantity}` : "";
      doc.text(`•  ${item.title}${qty}`, margin + 4, y);
      y += 5.5;
    }
    y += 4;
  }

  doc.save(`shopping-list-${record.due_date}.pdf`);
}

export function PurchasingConfirmedView({ record }: PurchasingConfirmedViewProps) {
  const snapshot = (record.snapshot || []) as SnapshotItem[];

  const purchased = snapshot.filter((i) => i.status === "purchased");
  const rejected = snapshot.filter((i) => i.status === "rejected");
  const pending = snapshot.filter((i) => i.status === "pending");

  const categories = [...new Set(snapshot.map((i) => i.category || "Other"))];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold flex-1">Confirmed List</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => generatePdf(record, snapshot)}
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </Button>
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
