import { Download, Code, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EXPORT_OPTIONS = [
  {
    name: "React App",
    description: "Export as a React + Vite project with Tailwind CSS and shadcn/ui components",
    icon: Code,
    badge: "Coming Soon",
  },
  {
    name: "Next.js App",
    description: "Full-stack Next.js project with API routes and server components",
    icon: Globe,
    badge: "Coming Soon",
  },
  {
    name: "Database Schema",
    description: "Export SQL migrations, RLS policies, and Supabase configuration",
    icon: Database,
    badge: "Coming Soon",
  },
];

export function AppBuilderExport() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Download className="w-5 h-5 text-orange-400" /> Export
      </h3>
      <p className="text-sm text-muted-foreground">Choose how you'd like to export your app plan.</p>

      <div className="space-y-3">
        {EXPORT_OPTIONS.map((opt) => (
          <div key={opt.name} className="rounded-2xl border border-border bg-card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <opt.icon className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-foreground">{opt.name}</h4>
                <Badge className="bg-muted text-muted-foreground border-0 text-xs">{opt.badge}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{opt.description}</p>
            </div>
            <Button variant="outline" size="sm" disabled className="shrink-0">
              Export
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
