import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Building2, Phone, Mail, Briefcase, Clock,
  Calendar, DollarSign, FileText, Star, MessageSquare,
  PhoneIncoming, PhoneOutgoing, MailOpen
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";

interface CustomerInfo {
  id: string;
  name: string;
  company_name: string | null;
  status: string | null;
  payment_terms: string | null;
  credit_limit: number | null;
  notes: string | null;
}

interface ContactInfo {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
}

interface LeadInfo {
  id: string;
  title: string;
  stage: string;
  expected_value: number | null;
  updated_at: string;
}

interface ActivityItem {
  id: string;
  type: "email" | "call" | "sms" | "order" | "quote" | "lead" | "meeting";
  title: string;
  subtitle: string | null;
  date: string;
  direction?: "inbound" | "outbound";
  amount?: number | null;
  status?: string | null;
}

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

interface InboxCustomerContextProps {
  senderEmail: string;
  senderName: string;
}

export function InboxCustomerContext({ senderEmail, senderName }: InboxCustomerContextProps) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [leads, setLeads] = useState<LeadInfo[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<StatCard[]>([]);

  useEffect(() => {
    if (!senderEmail) return;
    loadContext();
  }, [senderEmail]);

  const loadContext = async () => {
    setLoading(true);
    try {
      // 1. Find contact by email
      const { data: contactData } = await supabase
        .from("contacts")
        .select("*, customers(*)")
        .ilike("email", `%${senderEmail}%`)
        .limit(1);

      let custId: string | null = null;

      if (contactData && contactData.length > 0) {
        const contact = contactData[0];
        const cust = contact.customers as unknown as CustomerInfo | null;
        if (cust) {
          setCustomer(cust);
          custId = cust.id;
          setCustomerId(custId);
        }

        if (contact.customer_id) {
          custId = custId || contact.customer_id;
          const { data: allContacts } = await supabase
            .from("contacts")
            .select("*")
            .eq("customer_id", contact.customer_id)
            .limit(10);
          if (allContacts) setContacts(allContacts);
        } else {
          setContacts([contact]);
        }
      }

      // 2. Load all data in parallel
      const [leadsRes, commsRes, ordersRes, quotesRes, meetingsRes] = await Promise.allSettled([
        // Leads
        supabase
          .from("leads")
          .select("id, title, stage, expected_value, updated_at")
          .or(`contact_email.ilike.%${senderEmail}%,company_name.ilike.%${senderName}%`)
          .order("updated_at", { ascending: false })
          .limit(10),
        // Communications (emails, calls, SMS)
        supabase
          .from("communications")
          .select("id, subject, from_address, to_address, received_at, source, direction, metadata, body_preview")
          .or(`from_address.ilike.%${senderEmail}%,to_address.ilike.%${senderEmail}%`)
          .order("received_at", { ascending: false })
          .limit(30),
        // Orders
        custId
          ? supabase
              .from("orders")
              .select("id, order_number, status, total_amount, order_date")
              .eq("customer_id", custId)
              .order("order_date", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
        // Quotes
        custId
          ? supabase
              .from("quotes")
              .select("id, quote_number, status, total_amount, created_at")
              .eq("customer_id", custId)
              .order("created_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
        // Meetings
        supabase
          .from("team_meetings")
          .select("id, title, status, started_at")
          .order("started_at", { ascending: false })
          .limit(5),
      ]);

      // Process leads
      const leadData = leadsRes.status === "fulfilled" ? (leadsRes.value as any).data ?? [] : [];
      setLeads(leadData);

      // Build unified activity timeline
      const allActivities: ActivityItem[] = [];

      // Communications → activities
      if (commsRes.status === "fulfilled") {
        const comms = (commsRes.value as any).data ?? [];
        comms.forEach((c: any) => {
          const meta = c.metadata as Record<string, unknown> | null;
          let type: ActivityItem["type"] = "email";
          if (c.source === "ringcentral") {
            type = (meta?.type as string) === "sms" ? "sms" : "call";
          }
          allActivities.push({
            id: c.id,
            type,
            title: c.subject || (type === "call" ? "Phone Call" : type === "sms" ? "SMS Message" : "(no subject)"),
            subtitle: type === "call"
              ? `${c.direction === "outbound" ? "Outgoing" : "Incoming"} call`
              : type === "sms"
                ? (c.body_preview?.slice(0, 60) || "SMS")
                : c.body_preview?.slice(0, 60) || null,
            date: c.received_at || c.created_at || "",
            direction: c.direction as "inbound" | "outbound" | undefined,
            status: null,
          });
        });
      }

      // Orders → activities
      if (ordersRes.status === "fulfilled") {
        const orders = (ordersRes.value as any).data ?? [];
        orders.forEach((o: any) => {
          allActivities.push({
            id: o.id,
            type: "order",
            title: `Order ${o.order_number || ""}`,
            subtitle: o.status ? `Status: ${o.status}` : null,
            date: o.order_date || o.created_at || "",
            amount: o.total_amount,
            status: o.status,
          });
        });
      }

      // Quotes → activities
      if (quotesRes.status === "fulfilled") {
        const quotes = (quotesRes.value as any).data ?? [];
        quotes.forEach((q: any) => {
          allActivities.push({
            id: q.id,
            type: "quote",
            title: `Quote ${q.quote_number || ""}`,
            subtitle: q.status ? `Status: ${q.status}` : null,
            date: q.created_at || "",
            amount: q.total_amount,
            status: q.status,
          });
        });
      }

      // Sort all by date descending
      allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(allActivities);

      // Build stat cards
      const ordersData = ordersRes.status === "fulfilled" ? ((ordersRes.value as any).data ?? []) : [];
      const quotesData = quotesRes.status === "fulfilled" ? ((quotesRes.value as any).data ?? []) : [];
      const meetingsData = meetingsRes.status === "fulfilled" ? ((meetingsRes.value as any).data ?? []) : [];

      const totalOrderValue = ordersData.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
      const emailCount = allActivities.filter(a => a.type === "email").length;
      const callCount = allActivities.filter(a => a.type === "call").length;
      const smsCount = allActivities.filter(a => a.type === "sms").length;

      setStats([
        {
          icon: <Mail className="w-4 h-4" />,
          label: "Emails",
          value: emailCount,
          color: "text-blue-400",
        },
        {
          icon: <Phone className="w-4 h-4" />,
          label: "Calls",
          value: callCount,
          color: "text-emerald-400",
        },
        {
          icon: <MessageSquare className="w-4 h-4" />,
          label: "SMS",
          value: smsCount,
          color: "text-green-400",
        },
        {
          icon: <FileText className="w-4 h-4" />,
          label: "Quotations",
          value: quotesData.length,
          color: "text-purple-400",
        },
        {
          icon: <DollarSign className="w-4 h-4" />,
          label: "Orders",
          value: totalOrderValue > 0 ? `$${totalOrderValue.toLocaleString()}` : ordersData.length,
          color: "text-amber-400",
        },
        {
          icon: <Star className="w-4 h-4" />,
          label: "Leads",
          value: leadData.length,
          color: "text-pink-400",
        },
      ]);
    } catch (err) {
      console.error("Failed to load customer context:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="activity" className="h-full flex flex-col">
      <TabsList className="mx-4 mt-3 mb-0 shrink-0 bg-muted/50 h-8">
        <TabsTrigger value="info" className="text-xs h-6 px-3">Customer Info</TabsTrigger>
        <TabsTrigger value="activity" className="text-xs h-6 px-3">
          All Activity ({activities.length})
        </TabsTrigger>
      </TabsList>

      {/* CUSTOMER INFO TAB */}
      <TabsContent value="info" className="flex-1 mt-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-5">
            {/* Contact card */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Contact</h3>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="font-medium text-sm">{senderName}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {senderEmail}
                </p>
                {contacts.length > 0 && contacts[0].phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> {contacts[0].phone}
                  </p>
                )}
                {contacts.length > 0 && contacts[0].role && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3" /> {contacts[0].role}
                  </p>
                )}
              </div>
            </div>

            {/* Customer details */}
            {customer && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Customer</h3>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{customer.name}</p>
                    {customer.status && (
                      <Badge variant={customer.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {customer.status}
                      </Badge>
                    )}
                  </div>
                  {customer.company_name && (
                    <p className="text-xs text-muted-foreground">{customer.company_name}</p>
                  )}
                  {customer.payment_terms && (
                    <p className="text-xs text-muted-foreground">Terms: {customer.payment_terms}</p>
                  )}
                  {customer.credit_limit != null && (
                    <p className="text-xs text-muted-foreground">Credit: ${customer.credit_limit.toLocaleString()}</p>
                  )}
                  {customer.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{customer.notes}</p>
                  )}
                </div>

                {contacts.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Other contacts</p>
                    {contacts.slice(1).map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                          {c.first_name.charAt(0)}
                        </div>
                        <span>{c.first_name} {c.last_name || ""}</span>
                        {c.role && <span className="text-[10px]">· {c.role}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Leads */}
            {leads.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Opportunities</h3>
                  <Badge variant="secondary" className="text-[10px] h-4">{leads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {leads.map((lead) => (
                    <div key={lead.id} className="rounded-lg border border-border p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium truncate flex-1">{lead.title}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{lead.stage}</Badge>
                      </div>
                      {lead.expected_value != null && (
                        <p className="text-[11px] text-muted-foreground">${lead.expected_value.toLocaleString()}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Updated {format(new Date(lead.updated_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!customer && leads.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <User className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="text-sm">No customer history found</p>
                <p className="text-xs mt-1">This appears to be a new contact</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      {/* ALL ACTIVITY TAB */}
      <TabsContent value="activity" className="flex-1 mt-0 overflow-hidden flex flex-col">
        {/* Stat bar (Odoo-style) */}
        <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-border shrink-0">
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center rounded-md bg-muted/40 py-1.5 px-1 gap-0.5"
            >
              <span className={s.color}>{s.icon}</span>
              <span className="text-xs font-bold">{s.value}</span>
              <span className="text-[9px] text-muted-foreground leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Activity timeline */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {activities.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Clock className="w-6 h-6 mx-auto opacity-30 mb-2" />
                <p className="text-xs">No activity found</p>
              </div>
            ) : (
              activities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const iconMap: Record<ActivityItem["type"], React.ReactNode> = {
    email: activity.direction === "outbound"
      ? <MailOpen className="w-3.5 h-3.5 text-blue-400" />
      : <Mail className="w-3.5 h-3.5 text-blue-400" />,
    call: activity.direction === "outbound"
      ? <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400" />
      : <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400" />,
    sms: <MessageSquare className="w-3.5 h-3.5 text-green-400" />,
    order: <DollarSign className="w-3.5 h-3.5 text-amber-400" />,
    quote: <FileText className="w-3.5 h-3.5 text-purple-400" />,
    lead: <Star className="w-3.5 h-3.5 text-pink-400" />,
    meeting: <Calendar className="w-3.5 h-3.5 text-cyan-400" />,
  };

  const typeBadgeMap: Record<ActivityItem["type"], { label: string; className: string }> = {
    email: { label: "Email", className: "bg-blue-500/15 text-blue-400" },
    call: { label: "Call", className: "bg-emerald-500/15 text-emerald-400" },
    sms: { label: "SMS", className: "bg-green-500/15 text-green-400" },
    order: { label: "Order", className: "bg-amber-500/15 text-amber-400" },
    quote: { label: "Quote", className: "bg-purple-500/15 text-purple-400" },
    lead: { label: "Lead", className: "bg-pink-500/15 text-pink-400" },
    meeting: { label: "Meeting", className: "bg-cyan-500/15 text-cyan-400" },
  };

  const badge = typeBadgeMap[activity.type];

  return (
    <div className="flex items-start gap-2.5 py-1.5 px-1 rounded-md hover:bg-muted/30 transition-colors cursor-default">
      <div className="mt-0.5 shrink-0">{iconMap[activity.type]}</div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium truncate flex-1">{activity.title}</p>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        {activity.subtitle && (
          <p className="text-[11px] text-muted-foreground truncate">{activity.subtitle}</p>
        )}
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground">
            {activity.date ? format(new Date(activity.date), "MMM d, h:mm a") : ""}
          </p>
          {activity.amount != null && activity.amount > 0 && (
            <span className="text-[10px] font-semibold text-amber-400">
              ${activity.amount.toLocaleString()}
            </span>
          )}
          {activity.status && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">{activity.status}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
