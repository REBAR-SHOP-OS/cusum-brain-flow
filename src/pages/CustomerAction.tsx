import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, CalendarPlus, ArrowLeft, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleActivityDialog } from "@/components/customers/ScheduleActivityDialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function CustomerAction() {
  const { customerId } = useParams<{ customerId: string }>();
  const [searchParams] = useSearchParams();
  const invoiceHighlight = searchParams.get("invoice");
  const navigate = useNavigate();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Fetch customer
  const { data: customer, isLoading: custLoading } = useQuery({
    queryKey: ["customer-action", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch primary contact
  const { data: contacts = [] } = useQuery({
    queryKey: ["customer-contacts", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("customer_id", customerId!)
        .order("is_primary", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch orders
  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Fetch invoices from accounting_mirror
  const { data: invoices = [] } = useQuery({
    queryKey: ["customer-invoices", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("accounting_mirror")
        .select("id, quickbooks_id, entity_type, balance, data, created_at")
        .eq("customer_id", customerId!)
        .eq("entity_type", "Invoice")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Fetch communications
  const { data: comms = [] } = useQuery({
    queryKey: ["customer-comms", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("communications")
        .select("id, source, subject, body_preview, direction, received_at, status")
        .eq("customer_id", customerId!)
        .order("received_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Fetch activity events
  const { data: activities = [] } = useQuery({
    queryKey: ["customer-activities", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_events")
        .select("id, event_type, description, created_at, metadata")
        .eq("entity_type", "customer")
        .eq("entity_id", customerId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];

  const handleCall = () => {
    if (primaryContact?.phone) {
      // Dispatch RingCentral call event
      window.dispatchEvent(new CustomEvent("rc:dial", { detail: { phone: primaryContact.phone } }));
    }
  };

  const handleEmail = () => {
    if (primaryContact?.email) {
      window.location.href = `mailto:${primaryContact.email}`;
    }
  };

  if (custLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Customer not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              {customer.company_name && (
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{customer.company_name}</span>
              )}
              {primaryContact && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{primaryContact.first_name} {primaryContact.last_name || ""}</span>
              )}
            </div>
          </div>
        </div>
        <Badge variant={customer.status === "active" ? "default" : "secondary"}>
          {customer.status || "unknown"}
        </Badge>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Button onClick={handleCall} disabled={!primaryContact?.phone} className="gap-2">
            <Phone className="h-4 w-4" /> Call
          </Button>
          <Button variant="secondary" onClick={handleEmail} disabled={!primaryContact?.email} className="gap-2">
            <Mail className="h-4 w-4" /> Email
          </Button>
          <Button variant="outline" onClick={() => setScheduleOpen(true)} className="gap-2">
            <CalendarPlus className="h-4 w-4" /> Schedule Activity
          </Button>
          {primaryContact?.phone && (
            <span className="text-xs text-muted-foreground self-center ml-2">{primaryContact.phone}</span>
          )}
          {primaryContact?.email && (
            <span className="text-xs text-muted-foreground self-center">{primaryContact.email}</span>
          )}
        </CardContent>
      </Card>

      {/* History Tabs */}
      <Tabs defaultValue={invoiceHighlight ? "invoices" : "orders"}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
          <TabsTrigger value="comms">Communications ({comms.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-2">
          {orders.length === 0 && <p className="text-sm text-muted-foreground p-4">No orders found</p>}
          {orders.map((o: any) => (
            <Card key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/accounting?tab=orders&search=${o.order_number}`)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "PP")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${(o.total_amount || 0).toLocaleString()}</p>
                  <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-2">
          {invoices.length === 0 && <p className="text-sm text-muted-foreground p-4">No invoices found</p>}
          {invoices.map((inv: any) => {
            const d = inv.data as any;
            const isHighlighted = inv.id === invoiceHighlight;
            return (
              <Card key={inv.id} className={`${isHighlighted ? "ring-2 ring-primary" : ""} hover:bg-muted/50`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Invoice #{d?.DocNumber || inv.quickbooks_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {d?.DueDate ? format(new Date(d.DueDate), "PP") : "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-destructive">${(inv.balance || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">balance</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="comms" className="space-y-2">
          {comms.length === 0 && <p className="text-sm text-muted-foreground p-4">No communications found</p>}
          {comms.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{c.direction}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {c.received_at ? format(new Date(c.received_at), "PP p") : ""}
                  </span>
                </div>
                <p className="text-sm font-medium">{c.subject || "(no subject)"}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{c.body_preview}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2">
          {activities.length === 0 && <p className="text-sm text-muted-foreground p-4">No activities logged</p>}
          {activities.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.event_type}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(a.created_at), "PP")}
                </span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <ScheduleActivityDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        customerId={customerId!}
        customerName={customer.name}
      />
    </div>
  );
}
