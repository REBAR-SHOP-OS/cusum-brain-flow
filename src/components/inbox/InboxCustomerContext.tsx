import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Building2, Phone, Mail, Briefcase, FileText, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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

interface RecentComm {
  id: string;
  subject: string | null;
  from: string;
  date: string;
  type: string;
}

interface InboxCustomerContextProps {
  senderEmail: string;
  senderName: string;
}

export function InboxCustomerContext({ senderEmail, senderName }: InboxCustomerContextProps) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [leads, setLeads] = useState<LeadInfo[]>([]);
  const [recentComms, setRecentComms] = useState<RecentComm[]>([]);

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

      if (contactData && contactData.length > 0) {
        const contact = contactData[0];
        const cust = contact.customers as unknown as CustomerInfo | null;
        if (cust) setCustomer(cust);

        // Get all contacts for this customer
        if (contact.customer_id) {
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

      // 2. Find leads with this email
      const { data: leadData } = await supabase
        .from("leads")
        .select("id, title, stage, expected_value, updated_at")
        .or(`contact_email.ilike.%${senderEmail}%,company_name.ilike.%${senderName}%`)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (leadData) setLeads(leadData);

      // 3. Recent communications from this sender
      const { data: commData } = await supabase
        .from("communications")
        .select("id, subject, from_address, received_at, source")
        .or(`from_address.ilike.%${senderEmail}%,to_address.ilike.%${senderEmail}%`)
        .order("received_at", { ascending: false })
        .limit(10);
      if (commData) {
        setRecentComms(commData.map(c => ({
          id: c.id,
          subject: c.subject,
          from: c.from_address || "",
          date: c.received_at || "",
          type: c.source || "email",
        })));
      }
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
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Sender card */}
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

        {/* Customer info */}
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

            {/* Other contacts at this customer */}
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

        {/* Leads / opportunities */}
        {leads.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
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

        {/* Recent communications */}
        {recentComms.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Recent Activity</h3>
              <Badge variant="secondary" className="text-[10px] h-4">{recentComms.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {recentComms.map((comm) => (
                <div key={comm.id} className="flex items-start gap-2 text-xs px-1 py-1">
                  <div className="mt-0.5 shrink-0">
                    {comm.type === "gmail" ? (
                      <Mail className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <Phone className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-foreground/80">{comm.subject || "(no subject)"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {comm.date ? format(new Date(comm.date), "MMM d, h:mm a") : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!customer && leads.length === 0 && recentComms.length <= 1 && (
          <div className="text-center text-muted-foreground py-8">
            <User className="w-8 h-8 mx-auto opacity-30 mb-2" />
            <p className="text-sm">No customer history found</p>
            <p className="text-xs mt-1">This appears to be a new contact</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
