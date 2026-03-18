import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Package, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
const loadJsPDF = () => import("jspdf").then(m => m.jsPDF);
import type { ConfirmedListRecord } from "@/hooks/usePurchasingDates";

interface PurchasingConfirmedViewProps {
  record: ConfirmedListRecord;
}

type SnapshotItem = {
  title: string;
  category: string | null;
  quantity: number;
  status: "purchased" | "rejected" | "pending";
  priority: string;
};

function generatePdf(record: ConfirmedListRecord, snapshot: SnapshotItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxW = pw - margin * 2;
  let y = margin;

  // Header
  doc.setFillColor(30, 30, 60);
  doc.rect(0, 0, pw, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Purchasing — Confirmed List", margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Due: ${record.due_date}    Confirmed: ${format(new Date(record.confirmed_at), "yyyy/MM/dd HH:mm")}`, margin, 22);
  y = 36;

  // Summary
  const purchased = snapshot.filter(i => i.status === "purchased").length;
  const rejected = snapshot.filter(i => i.status === "rejected").length;
  const pending = snapshot.filter(i => i.status === "pending").length;

  doc.setFontSize(10);
  doc.setTextColor(34, 139, 34);
  doc.text(`Purchased: ${purchased}`, margin, y);
  doc.setTextColor(220, 53, 69);
  doc.text(`Rejected: ${rejected}`, margin + 40, y);
  doc.setTextColor(120, 120, 120);
  doc.text(`Pending: ${pending}`, margin + 76, y);
  y += 8;

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pw - margin, y);
  y += 6;

  // Group by category
  const categories = [...new Set(snapshot.map(i => i.category || "Other"))];

  const checkPage = (needed = 8) => {
    if (y + needed > ph - 20) {
      doc.addPage();
      y = margin;
    }
  };

  for (const cat of categories) {
    const items = snapshot.filter(i => (i.category || "Other") === cat);
    checkPage(14);

    // Category header
    doc.setFillColor(240, 240, 245);
    doc.rect(margin, y - 4, maxW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 80);
    doc.text(cat, margin + 2, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    for (const item of items) {
      checkPage(6);

      let icon = "○";
      if (item.status === "purchased") {
        doc.setTextColor(34, 139, 34);
        icon = "✓";
      } else if (item.status === "rejected") {
        doc.setTextColor(220, 53, 69);
        icon = "✗";
      } else {
        doc.setTextColor(120, 120, 120);
      }

      const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
      doc.text(`${icon}  ${item.title}${qty}`, margin + 4, y);
      y += 5;
    }
    y += 3;
  }

  // Footer
  const footerY = ph - 10;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Rebar.Shop Inc — Generated " + format(new Date(), "yyyy/MM/dd HH:mm"), margin, footerY);

  doc.save(`purchasing-list-${record.due_date}.pdf`);
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
