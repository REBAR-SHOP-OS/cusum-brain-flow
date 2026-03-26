import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Package, Receipt } from "lucide-react";

interface Props {
  leadId: string;
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

export function LeadSmartButtons({ leadId }: Props) {
  const { data: quotes } = useQuery({
    queryKey: ["lead_smart_quotes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_quotations")
        .select("id, amount")
        .eq("sales_lead_id", leadId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["lead_smart_orders", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, total_amount")
        .eq("lead_id", leadId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["lead_smart_invoices", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("id, amount")
        .eq("sales_lead_id", leadId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = [
    {
      icon: FileText,
      label: "Quotes",
      count: quotes?.length ?? 0,
      total: quotes?.reduce((s, q) => s + (q.amount ?? 0), 0) ?? 0,
    },
    {
      icon: Package,
      label: "Orders",
      count: orders?.length ?? 0,
      total: orders?.reduce((s, o) => s + (o.total_amount ?? 0), 0) ?? 0,
    },
    {
      icon: Receipt,
      label: "Invoices",
      count: invoices?.length ?? 0,
      total: invoices?.reduce((s, i) => s + (i.amount ?? 0), 0) ?? 0,
    },
  ];

  return (
    <div className="px-4 py-2 border-b border-border bg-background">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-center hover:bg-accent/30 transition-colors cursor-default"
            >
              <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold text-foreground">
                  {item.count} {item.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatCurrency(item.total)}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
