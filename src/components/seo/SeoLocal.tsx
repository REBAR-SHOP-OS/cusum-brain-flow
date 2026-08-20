import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MapPin, Search, Star, Users, Building2, Loader2, ChevronDown, ListChecks, Sparkles,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuditItem {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  is_task: boolean;
  expected_impact?: string;
}

interface AuditCategory {
  name: string;
  icon: string;
  items: AuditItem[];
}

interface AuditResult {
  audit: { categories: AuditCategory[] };
  tasksCreated: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "map-pin": <MapPin className="w-4 h-4" />,
  search: <Search className="w-4 h-4" />,
  star: <Star className="w-4 h-4" />,
  users: <Users className="w-4 h-4" />,
  building: <Building2 className="w-4 h-4" />,
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-orange-500/10 text-orange-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-blue-500/10 text-blue-500",
};

export function SeoLocal() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const runLocalAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-local-audit", {
        body: {
          domain: "rebar.shop",
          location: "Toronto/GTA, Ontario, Canada",
        },
      });
      if (error) throw error;
      setResult(data as AuditResult);
      setChecked({});
      // Auto-expand all categories
      const expanded: Record<string, boolean> = {};
      (data as AuditResult).audit.categories.forEach((c: AuditCategory) => {
        expanded[c.name] = true;
      });
      setOpenCategories(expanded);

      if (data.tasksCreated > 0) {
        toast.success(`${data.tasksCreated} SEO tasks auto-generated`, {
          description: "View them in the Tasks tab",
        });
      }
    } catch (err: any) {
      toast.error("Failed to run local audit", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = (key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const categories = result?.audit?.categories || [];
  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);
  const completedItems = Object.values(checked).filter(Boolean).length;
  const highPriorityCount = categories.reduce(
    (s, c) => s + c.items.filter((i) => i.priority === "high" || i.priority === "critical").length,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Local SEO</h1>
        <p className="text-muted-foreground mt-1">
          Structured audit, checklist tracking, and automatic task generation for local search visibility.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{totalItems || "—"}</p>
            <p className="text-xs text-muted-foreground">{categories.length} categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {totalItems ? `${completedItems}/${totalItems}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Checklist progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Tasks Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{result?.tasksCreated ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Auto-generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-destructive" />
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{highPriorityCount || "—"}</p>
            <p className="text-xs text-muted-foreground">Critical + High items</p>
          </CardContent>
        </Card>
      </div>

      {/* Run Audit Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Local SEO Audit</p>
              <p className="text-xs text-muted-foreground">
                AI-powered audit for rebar.shop in the GTA market with auto-task generation.
              </p>
            </div>
            <Button onClick={runLocalAudit} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <MapPin className="w-4 h-4 mr-2" />
              )}
              {result ? "Re-run Audit" : "Run Local SEO Audit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Category Cards */}
      {categories.map((category) => (
        <Collapsible
          key={category.name}
          open={openCategories[category.name] ?? false}
          onOpenChange={(open) =>
            setOpenCategories((prev) => ({ ...prev, [category.name]: open }))
          }
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    {ICON_MAP[category.icon] || <MapPin className="w-4 h-4" />}
                    {category.name}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {category.items.length} items
                    </Badge>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      openCategories[category.name] ? "rotate-180" : ""
                    }`}
                  />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {category.items.map((item, idx) => {
                  const key = `${category.name}-${idx}`;
                  return (
                    <div
                      key={key}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        checked[key] ? "bg-muted/40 opacity-60" : "bg-background"
                      }`}
                    >
                      <Checkbox
                        checked={checked[key] || false}
                        onCheckedChange={() => toggleCheck(key)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium ${
                              checked[key] ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {item.title}
                          </span>
                          <Badge className={`text-[10px] ${PRIORITY_STYLES[item.priority] || ""}`}>
                            {item.priority}
                          </Badge>
                          {item.is_task && (
                            <Badge variant="outline" className="text-[10px]">
                              Task
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                        {item.expected_impact && (
                          <p className="text-xs text-primary/80">
                            Impact: {item.expected_impact}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
