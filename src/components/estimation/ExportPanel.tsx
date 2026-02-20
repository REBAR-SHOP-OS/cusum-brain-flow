import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ExportPanelProps {
  project: any;
  items: any[];
}

export default function ExportPanel({ project, items }: ExportPanelProps) {
  const exportExcel = () => {
    const rows = items.map((i: any) => ({
      Element: i.element_type,
      Ref: i.element_ref,
      Mark: i.mark,
      "Bar Size": i.bar_size,
      Qty: i.quantity,
      "Cut Length (mm)": i.cut_length_mm,
      "Total Length (mm)": i.total_length_mm,
      "Weight (kg)": i.weight_kg,
      "Unit Cost": i.unit_cost,
      "Line Cost": i.line_cost,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM");

    // Summary sheet
    const summary = [
      { Metric: "Project", Value: project.name },
      { Metric: "Total Weight (kg)", Value: project.total_weight_kg },
      { Metric: "Total Cost ($)", Value: project.total_cost },
      { Metric: "Labor Hours", Value: project.labor_hours },
      { Metric: "Waste %", Value: project.waste_factor_pct },
      { Metric: "Items", Value: items.length },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    XLSX.writeFile(wb, `${project.name || "estimate"}.xlsx`);
    toast.success("Excel exported");
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ project, items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name || "estimate"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exported");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Export Options</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel (XLSX)
        </Button>
        <Button variant="outline" onClick={exportJSON}>
          <FileJson className="h-4 w-4 mr-2" /> Export JSON
        </Button>
      </CardContent>
    </Card>
  );
}
