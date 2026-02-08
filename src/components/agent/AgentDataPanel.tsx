import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, FileText, Truck, Mail, BarChart3, Factory, Share2, Calculator } from "lucide-react";

interface AgentDataPanelProps {
  agentId: string;
}

export function AgentDataPanel({ agentId }: AgentDataPanelProps) {
  switch (agentId) {
    case "sales":
      return <SalesPanel />;
    case "support":
      return <CustomersPanel />;
    case "accounting":
      return <AccountingPanel />;
    case "estimating":
      return <EstimatingPanel />;
    case "shopfloor":
      return <ShopFloorPanel />;
    case "delivery":
      return <DeliveryPanel />;
    case "email":
      return <EmailPanel />;
    case "social":
      return <SocialPanel />;
    case "data":
      return <DataPanel />;
    default:
      return <GenericPanel title="Agent" icon={BarChart3} />;
  }
}

// Reusable stat card
function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent || "bg-primary/10"}`}>
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// Reusable list item
function ListItem({ title, subtitle, badge, badgeVariant }: { 
  title: string; subtitle: string; badge?: string; badgeVariant?: "default" | "secondary" | "destructive" | "outline" 
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {badge && <Badge variant={badgeVariant || "secondary"} className="text-[10px] shrink-0">{badge}</Badge>}
    </div>
  );
}

function GenericPanel({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 text-center text-muted-foreground">
        <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{title} data will appear here</p>
      </div>
    </ScrollArea>
  );
}

function SalesPanel() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, qualified: 0, value: 0 });

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("leads").select("*").order("updated_at", { ascending: false }).limit(10);
      if (data) {
        setLeads(data);
        const qualified = data.filter((l) => l.stage === "qualified" || l.stage === "proposal").length;
        const value = data.reduce((sum, l) => sum + (l.expected_value || 0), 0);
        setStats({ total: data.length, qualified, value });
      }
    }
    load();
  }, []);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Leads" value={stats.total} icon={TrendingUp} />
          <StatCard label="Qualified" value={stats.qualified} icon={Users} />
        </div>
        {stats.value > 0 && (
          <StatCard label="Pipeline Value" value={`$${(stats.value / 1000).toFixed(0)}K`} icon={BarChart3} />
        )}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Leads</h3>
          {leads.map((lead) => (
            <ListItem
              key={lead.id}
              title={lead.title}
              subtitle={lead.source || "Unknown source"}
              badge={lead.stage}
              badgeVariant={lead.stage === "won" ? "default" : "secondary"}
            />
          ))}
          {leads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet</p>}
        </div>
      </div>
    </ScrollArea>
  );
}

function CustomersPanel() {
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("customers").select("*").order("updated_at", { ascending: false }).limit(15);
      if (data) setCustomers(data);
    }
    load();
  }, []);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <StatCard label="Total Customers" value={customers.length} icon={Users} />
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Customers</h3>
          {customers.map((c) => (
            <ListItem
              key={c.id}
              title={c.name}
              subtitle={c.company_name || "Individual"}
              badge={c.status || "active"}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function AccountingPanel() {
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("accounting_mirror")
        .select("*")
        .eq("entity_type", "Invoice")
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setInvoices(data);
    }
    load();
  }, []);

  const totalBalance = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Invoices" value={invoices.length} icon={FileText} />
          <StatCard label="Outstanding" value={`$${totalBalance.toFixed(0)}`} icon={Calculator} />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Invoices</h3>
          {invoices.map((inv) => (
            <ListItem
              key={inv.id}
              title={`QB #${inv.quickbooks_id}`}
              subtitle={`Balance: $${(inv.balance || 0).toFixed(2)}`}
              badge={inv.balance > 0 ? "Outstanding" : "Paid"}
              badgeVariant={inv.balance > 0 ? "destructive" : "default"}
            />
          ))}
          {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoice data synced yet</p>}
        </div>
      </div>
    </ScrollArea>
  );
}

function EstimatingPanel() {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h3 className="text-sm font-semibold mb-2">📐 Rebar Estimation</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Upload structural drawings (PDF, DWG, images) and Gauge will extract rebar quantities, 
            calculate weights using CSA G30.18 standards, and produce detailed takeoff reports.
          </p>
        </Card>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Supported Formats</h3>
          <div className="flex flex-wrap gap-2">
            {["PDF", "AutoCAD DWG", "DXF", "Images (JPG/PNG)", "Revit RVT"].map((fmt) => (
              <Badge key={fmt} variant="outline" className="text-[10px]">{fmt}</Badge>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function ShopFloorPanel() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(10);
      if (data) setWorkOrders(data);
    }
    load();
  }, []);

  const active = workOrders.filter((wo) => wo.status === "in_progress").length;

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Work Orders" value={workOrders.length} icon={Factory} />
          <StatCard label="In Progress" value={active} icon={BarChart3} />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Work Orders</h3>
          {workOrders.map((wo) => (
            <ListItem
              key={wo.id}
              title={wo.work_order_number}
              subtitle={wo.workstation || "Unassigned"}
              badge={wo.status || "pending"}
            />
          ))}
          {workOrders.length === 0 && <p className="text-sm text-muted-foreground">No work orders yet</p>}
        </div>
      </div>
    </ScrollArea>
  );
}

function DeliveryPanel() {
  const [deliveries, setDeliveries] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("deliveries").select("*").order("scheduled_date", { ascending: false }).limit(10);
      if (data) setDeliveries(data);
    }
    load();
  }, []);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <StatCard label="Deliveries" value={deliveries.length} icon={Truck} />
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Deliveries</h3>
          {deliveries.map((d) => (
            <ListItem
              key={d.id}
              title={d.delivery_number}
              subtitle={d.driver_name || "No driver"}
              badge={d.status || "scheduled"}
            />
          ))}
          {deliveries.length === 0 && <p className="text-sm text-muted-foreground">No deliveries yet</p>}
        </div>
      </div>
    </ScrollArea>
  );
}

function EmailPanel() {
  const [comms, setComms] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("communications")
        .select("*")
        .eq("source", "email")
        .order("received_at", { ascending: false })
        .limit(10);
      if (data) setComms(data);
    }
    load();
  }, []);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <StatCard label="Recent Emails" value={comms.length} icon={Mail} />
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inbox</h3>
          {comms.map((c) => (
            <ListItem
              key={c.id}
              title={c.subject || "(No subject)"}
              subtitle={c.from_address || "Unknown"}
              badge={c.status || "unread"}
            />
          ))}
          {comms.length === 0 && <p className="text-sm text-muted-foreground">No emails synced yet</p>}
        </div>
      </div>
    </ScrollArea>
  );
}

function SocialPanel() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("social_posts")
        .select("*")
        .order("scheduled_date", { ascending: false })
        .limit(20);
      if (data) setPosts(data);
    }
    load();
  }, []);

  const published = posts.filter((p) => p.status === "published").length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const drafts = posts.filter((p) => p.status === "draft").length;

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Posts" value={posts.length} icon={Share2} />
          <StatCard label="Published" value={published} icon={TrendingUp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Scheduled" value={scheduled} icon={BarChart3} />
          <StatCard label="Drafts" value={drafts} icon={FileText} />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Posts</h3>
          {posts.map((p) => (
            <ListItem
              key={p.id}
              title={p.title || "(Untitled)"}
              subtitle={`${p.platform} · ${p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : "No date"}`}
              badge={p.status}
              badgeVariant={p.status === "published" ? "default" : p.status === "scheduled" ? "secondary" : "outline"}
            />
          ))}
          {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet — ask Pixel to create some!</p>}
        </div>
      </div>
    </ScrollArea>
  );
}

function DataPanel() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(10);
      if (data) setTasks(data);
    }
    load();
  }, []);

  const completed = tasks.filter((t) => t.status === "completed").length;

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Tasks" value={tasks.length} icon={BarChart3} />
          <StatCard label="Completed" value={completed} icon={Share2} />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</h3>
          {tasks.map((t) => (
            <ListItem
              key={t.id}
              title={t.title}
              subtitle={t.agent_type || "Manual"}
              badge={t.status || "pending"}
            />
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet</p>}
        </div>
      </div>
    </ScrollArea>
  );
}
