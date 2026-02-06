import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Phone, Mail, DollarSign, FileText, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;
type Contact = Tables<"contacts">;
type Order = Tables<"orders">;
type Quote = Tables<"quotes">;
type Communication = Tables<"communications">;

interface CustomerDetailProps {
  customer: Customer;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomerDetail({ customer, onEdit, onDelete }: CustomerDetailProps) {
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("customer_id", customer.id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Quote[];
    },
  });

  const { data: communications = [] } = useQuery({
    queryKey: ["communications", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications")
        .select("*")
        .eq("customer_id", customer.id)
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Communication[];
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{customer.name}</h2>
            {customer.company_name && (
              <p className="text-sm text-muted-foreground">{customer.company_name}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                {customer.status}
              </Badge>
              <Badge variant="outline">{customer.customer_type}</Badge>
              {customer.payment_terms && (
                <Badge variant="outline">{customer.payment_terms}</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-secondary/50 rounded-lg">
            <p className="text-2xl font-semibold">{orders.length}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div className="text-center p-3 bg-secondary/50 rounded-lg">
            <p className="text-2xl font-semibold">{quotes.length}</p>
            <p className="text-xs text-muted-foreground">Quotes</p>
          </div>
          <div className="text-center p-3 bg-secondary/50 rounded-lg">
            <p className="text-2xl font-semibold">
              {customer.credit_limit ? `$${customer.credit_limit.toLocaleString()}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Credit Limit</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-4 justify-start">
          <TabsTrigger value="contacts" className="gap-1">
            <Phone className="w-3 h-3" />
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1">
            <FileText className="w-3 h-3" />
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1">
            <DollarSign className="w-3 h-3" />
            Quotes ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="comms" className="gap-1">
            <MessageSquare className="w-3 h-3" />
            Comms ({communications.length})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-6 py-4">
          <TabsContent value="contacts" className="mt-0 space-y-3">
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No contacts</p>
            ) : (
              contacts.map((contact) => (
                <Card key={contact.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {contact.first_name} {contact.last_name}
                          {contact.is_primary && (
                            <Badge variant="secondary" className="ml-2 text-xs">Primary</Badge>
                          )}
                        </p>
                        {contact.role && (
                          <p className="text-sm text-muted-foreground">{contact.role}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm">
                      {contact.email && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-0 space-y-3">
            {orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No orders</p>
            ) : (
              orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.order_date && format(new Date(order.order_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${order.total_amount?.toLocaleString() ?? 0}
                        </p>
                        <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="quotes" className="mt-0 space-y-3">
            {quotes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No quotes</p>
            ) : (
              quotes.map((quote) => (
                <Card key={quote.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{quote.quote_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(quote.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${quote.total_amount?.toLocaleString() ?? 0}
                        </p>
                        <Badge
                          variant={
                            quote.status === "accepted"
                              ? "default"
                              : quote.status === "sent"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {quote.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="comms" className="mt-0 space-y-3">
            {communications.length === 0 ? (
              <p className="text-muted-foreground text-sm">No communications</p>
            ) : (
              communications.map((comm) => (
                <Card key={comm.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{comm.subject || "No subject"}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {comm.body_preview}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0 ml-4">
                        <Badge variant="outline" className="mb-1">{comm.source}</Badge>
                        <p>
                          {comm.received_at && format(new Date(comm.received_at), "MMM d")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Notes */}
      {customer.notes && (
        <div className="px-6 py-4 border-t border-border bg-secondary/30">
          <p className="text-xs font-medium text-muted-foreground mb-1">NOTES</p>
          <p className="text-sm">{customer.notes}</p>
        </div>
      )}
    </div>
  );
}
