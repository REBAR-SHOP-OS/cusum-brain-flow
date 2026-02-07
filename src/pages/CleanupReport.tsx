import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  Code, 
  Layout, 
  Shield,
  ArrowRight,
  Clock,
  Wrench
} from "lucide-react";

interface CleanupItem {
  label: string;
  detail?: string;
  severity: "removed" | "deprecated" | "debt" | "done";
}

const removedItems: CleanupItem[] = [
  { label: "src/components/NavLink.tsx", detail: "Unused wrapper around React Router NavLink — never imported", severity: "removed" },
  { label: "src/hooks/useFirebaseCollection.ts", detail: "Legacy Firebase hooks — all data migrated to Lovable Cloud", severity: "removed" },
  { label: "src/lib/firebase.ts", detail: "Firebase initialization — no longer used after Cloud migration", severity: "removed" },
  { label: "src/components/shopfloor/ProductionProgress.tsx", detail: "Circular SVG progress ring — replaced by inline conic-gradient in BenderStationView", severity: "removed" },
  { label: "src/pages/Team.tsx", detail: "Orphaned page with no route defined in App.tsx", severity: "removed" },
  { label: "console.log/warn statements (5 instances)", detail: "Removed from useIntegrations.ts, BenderStationView, CutterStationView", severity: "removed" },
];

const databaseCleanup: CleanupItem[] = [
  { label: "Fixed custom_shape_schematics RLS", detail: "INSERT/DELETE were USING(true) — now restricted to admin/office roles", severity: "done" },
  { label: "Added UPDATE policy on custom_shape_schematics", detail: "Missing policy — now admin-only", severity: "done" },
  { label: "Added 8 performance indexes", detail: "cut_plan_items(plan_id, bar_code), cut_plans(machine_id, status), machine_runs(machine_id+status), events(entity_type), production_tasks(status), machine_queue_items(company_id)", severity: "done" },
  { label: "FK cascade audit passed", detail: "All ON DELETE CASCADE is on appropriate child tables (queue→tasks, chat_messages→sessions, stops→deliveries). No dangerous cascades on critical history tables.", severity: "done" },
  { label: "Unique partial index verified", detail: "idx_queue_task_active ensures no double-queuing of production tasks", severity: "done" },
];

const deprecatedItems: CleanupItem[] = [
  { label: "src/pages/InboxManager.tsx (293 lines)", detail: "Onboarding wizard for Inbox — only reachable via /inbox-manager which redirects to /inbox. Kept for potential future re-use of the setup flow.", severity: "deprecated" },
  { label: "firebase npm package", detail: "Uninstalled in the Collections Audit pass. No Firebase code or dependencies remain.", severity: "removed" },
  { label: "InventoryStatusPanel.tsx", detail: "Was removed from station detail views in the UI redesign. Still a valid component — should be re-added to detail views or office portal.", severity: "deprecated" },
];

const techDebt: CleanupItem[] = [
  { label: "LiveMonitor.tsx is 244 lines", detail: "Contains inline StatCard component. Consider extracting to separate file.", severity: "debt" },
  { label: "InboxView.tsx is large", detail: "Contains email rendering, AI toolbar, and settings in one file. Consider splitting into smaller composables.", severity: "debt" },
  { label: "Edge functions lack shared validation middleware", detail: "Each edge function re-implements auth checks and CORS. Extract a shared handler wrapper.", severity: "debt" },
  { label: "Event writing is duplicated", detail: "Multiple edge functions write to events table with slightly different metadata formats. Standardize event schema and create a shared writeEvent utility.", severity: "debt" },
  { label: "No automated test coverage for edge functions", detail: "smart-dispatch, manage-inventory, manage-machine have complex transactional logic with no tests.", severity: "debt" },
  { label: "Office role read-only enforcement is UI-only", detail: "Office users see no action buttons, but RLS policies on some tables (events, deliveries) use generic auth.role()='authenticated'. Should be tightened with has_role checks.", severity: "debt" },
  { label: "ShopFloor hub cards link to placeholder routes", detail: "TIME CLOCK, TEAM HUB, CLEARANCE, LOADING ST. all link to /shop-floor (self-referencing). Should be marked as 'Coming Soon' or removed.", severity: "debt" },
  { label: "Leaked password protection disabled", detail: "Supabase auth has this disabled. Enable in auth settings for production security.", severity: "debt" },
];

const recommendedRefactors: string[] = [
  "Extract shared edge function utilities (auth, CORS, event writing) into supabase/functions/_shared/",
  "Add Deno tests for smart-dispatch and manage-inventory transactional guarantees",
  "Re-integrate InventoryStatusPanel into CutterStationView and BenderStationView as a collapsible side panel",
  "Implement proper office role read-only RLS on events, deliveries, and delivery_stops tables",
  "Firebase npm package has been uninstalled ✓",
  "Add proper loading skeletons to all station views for better perceived performance",
  "Implement the TIME CLOCK, TEAM HUB, CLEARANCE, and LOADING ST. modules or mark as coming soon",
  "Add end-to-end tests for production task lifecycle: dispatch → queue → start → complete",
];

const severityConfig = {
  removed: { icon: Trash2, color: "text-destructive", bg: "bg-destructive/10", label: "Removed" },
  deprecated: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "Deprecated" },
  debt: { icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10", label: "Tech Debt" },
  done: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Fixed" },
};

export default function CleanupReport() {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Construction Cleanup Report</h1>
              <p className="text-sm text-muted-foreground">
                Jobsite closeout — {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              <Trash2 className="w-3 h-3 mr-1" />
              {removedItems.length} Removed
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {databaseCleanup.length} DB Fixes
            </Badge>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {deprecatedItems.length} Deprecated
            </Badge>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
              <Clock className="w-3 h-3 mr-1" />
              {techDebt.length} Tech Debt
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Removed Items */}
        <Section
          icon={<Code className="w-5 h-5" />}
          title="Code Removed"
          subtitle="Dead files, unused imports, and debug prints eliminated"
          items={removedItems}
        />

        {/* Database Cleanup */}
        <Section
          icon={<Database className="w-5 h-5" />}
          title="Database Cleanup"
          subtitle="RLS fixes, missing indexes added, FK cascades audited"
          items={databaseCleanup}
        />

        {/* Deprecated */}
        <Section
          icon={<AlertTriangle className="w-5 h-5" />}
          title="Deprecated (Kept for Now)"
          subtitle="Files and packages that can be removed in a future pass"
          items={deprecatedItems}
        />

        {/* Tech Debt */}
        <Section
          icon={<Shield className="w-5 h-5" />}
          title="Remaining Tech Debt"
          subtitle="Known limitations and areas needing attention"
          items={techDebt}
        />

        {/* Recommended Refactors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layout className="w-5 h-5 text-primary" />
              Recommended Next Refactors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {recommendedRefactors.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

function Section({ icon, title, subtitle, items }: { 
  icon: React.ReactNode; 
  title: string; 
  subtitle: string;
  items: CleanupItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => {
          const config = severityConfig[item.severity];
          const Icon = config.icon;
          return (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-b-0">
              <div className={`p-1 rounded ${config.bg} shrink-0 mt-0.5`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                {item.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                )}
              </div>
              <Badge variant="outline" className={`text-[9px] shrink-0 ${config.bg} ${config.color} border-current/20`}>
                {config.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
