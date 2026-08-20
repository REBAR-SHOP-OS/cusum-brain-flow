import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Calendar } from "lucide-react";
import { format } from "date-fns";

interface PackingSlip {
  id: string;
  slip_number: string;
  customer_name: string;
  ship_to: string | null;
  items_json: any;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  delivered: "bg-primary/20 text-primary",
  archived: "bg-muted text-muted-foreground",
};

export function CustomerDocuments({ packingSlips }: { packingSlips: PackingSlip[] }) {
  if (packingSlips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileCheck className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No documents found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {packingSlips.map((slip) => {
        const items = Array.isArray(slip.items_json) ? slip.items_json : [];
        const itemCount = items.length;

        return (
          <Card key={slip.id} className="hover:bg-muted/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{slip.slip_number}</span>
                </div>
                <Badge className={statusColors[slip.status] || statusColors.draft}>
                  {slip.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(slip.created_at), "MMM d, yyyy")}
                </span>
                {slip.ship_to && <span>{slip.ship_to}</span>}
                <span>{itemCount} item(s)</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
