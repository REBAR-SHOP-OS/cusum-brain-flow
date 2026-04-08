import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Package, Receipt, Mail, Send, Loader2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { getStatusInfo } from "@/hooks/useSalesQuotations";

interface Props {
  leadId: string;
  contactEmail?: string | null;
  companyId?: string | null;
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

export function LeadSmartButtons({ leadId, contactEmail, companyId }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [sendDialog, setSendDialog] = useState<{ quoteId: string; quotationNumber: string } | null>(null);
  const [email, setEmail] = useState(contactEmail ?? "");
  const [sending, setSending] = useState(false);

  const { data: quotes } = useQuery({
    queryKey: ["lead_smart_quotes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_quotations")
        .select("id, amount, quotation_number, status, customer_name")
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

  const handleSendQuote = async () => {
    if (!sendDialog || !email.trim()) return;
    setSending(true);
    try {
      await invokeEdgeFunction("send-quote-email", {
        quote_id: sendDialog.quoteId,
        customer_email: email.trim(),
        action: "send_quote",
      });
      // Update status to sent_to_customer
      await supabase
        .from("sales_quotations")
        .update({ status: "sent_to_customer" } as any)
        .eq("id", sendDialog.quoteId);

      // Log to timeline
      if (companyId) {
        await supabase.from("sales_lead_activities").insert({
          sales_lead_id: leadId,
          company_id: companyId,
          activity_type: "email",
          subject: `Quote ${sendDialog.quotationNumber} sent`,
          body: `Quotation ${sendDialog.quotationNumber} sent to ${email.trim()}`,
          completed_at: new Date().toISOString(),
        } as any);
        qc.invalidateQueries({ queryKey: ["sales_lead_activities", leadId] });
      }

      qc.invalidateQueries({ queryKey: ["lead_smart_quotes", leadId] });
      toast.success(`Quote ${sendDialog.quotationNumber} sent to ${email.trim()}`);
      setSendDialog(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send quote");
    } finally {
      setSending(false);
    }
  };

  const items = [
    {
      icon: FileText,
      label: "Quotes",
      count: quotes?.length ?? 0,
      total: quotes?.reduce((s, q) => s + (q.amount ?? 0), 0) ?? 0,
      hasAction: true,
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
    <>
      <div className="px-4 py-2 border-b border-border bg-background">
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) =>
            item.label === "Quotes" && (quotes?.length ?? 0) > 0 ? (
              <Popover key={item.label} open={quotesOpen} onOpenChange={setQuotesOpen}>
                <PopoverTrigger asChild>
                   <button
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-center hover:bg-accent/30 transition-colors cursor-pointer w-full"
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 text-left flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {item.count} {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatCurrency(item.total)}</p>
                    </div>
                    <span
                      className="shrink-0 cursor-pointer"
                      title="Add Quotation"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/sales/quotations");
                      }}
                    >
                      <Plus className="w-4 h-4 text-muted-foreground hover:text-primary" />
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2">
                  <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Quotations</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {quotes?.map((q) => {
                      const status = getStatusInfo(q.status);
                      return (
                        <div key={q.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/30 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{q.quotation_number}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${status.color}`}>
                                {status.label}
                              </span>
                              <span className="text-muted-foreground">{formatCurrency(q.amount ?? 0)}</span>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            title="Send quote"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEmail(contactEmail ?? "");
                              setSendDialog({ quoteId: q.id, quotationNumber: q.quotation_number });
                              setQuotesOpen(false);
                            }}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-center hover:bg-accent/30 transition-colors cursor-default"
              >
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 text-left flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {item.count} {item.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatCurrency(item.total)}</p>
                </div>
                {item.label === "Quotes" && (
                  <span
                    className="shrink-0 cursor-pointer"
                    title="Add Quotation"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/sales/quotations");
                    }}
                  >
                    <Plus className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  </span>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Send Quote Email Dialog */}
      <Dialog open={!!sendDialog} onOpenChange={(open) => !open && setSendDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Send {sendDialog?.quotationNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Customer Email</label>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              size="sm"
              disabled={!email.trim() || sending}
              onClick={handleSendQuote}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
