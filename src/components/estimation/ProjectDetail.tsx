import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Weight, DollarSign, Clock, Percent, AlertTriangle, MapPin } from "lucide-react";
import BOMTable from "./BOMTable";
import ExportPanel from "./ExportPanel";
import AnnotatedDrawingViewer from "./AnnotatedDrawingViewer";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

export default function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["estimation_project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimation_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["estimation_items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimation_items")
        .select("*")
        .eq("project_id", projectId)
        .order("element_type", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const allWarnings = items.flatMap((i: any) => i.warnings ?? []);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["estimation_items", projectId] });
    queryClient.invalidateQueries({ queryKey: ["estimation_project", projectId] });
  };

  // Extract source file URLs from project
  const sourceFileUrls: string[] = (() => {
    if (!project?.source_files) return [];
    const sf = project.source_files;
    if (Array.isArray(sf)) {
      return sf.map((f: any) => (typeof f === "string" ? f : f?.url)).filter(Boolean);
    }
    return [];
  })();

  const hasAnnotations = items.some((i: any) => i.bbox);

  if (!project) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="secondary">{project.status}</Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Weight, label: "Total Weight", value: `${(project.total_weight_kg ?? 0).toLocaleString()} kg` },
          { icon: DollarSign, label: "Total Cost", value: `$${(project.total_cost ?? 0).toLocaleString()}` },
          { icon: Clock, label: "Labor Hours", value: String(project.labor_hours ?? 0) },
          { icon: Percent, label: "Waste", value: `${project.waste_factor_pct ?? 0}%` },
          { icon: AlertTriangle, label: "Warnings", value: String(allWarnings.length) },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <kpi.icon className="h-3.5 w-3.5" /> {kpi.label}
              </div>
              <p className="text-lg font-bold mt-0.5">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={hasAnnotations ? "drawings" : "bom"}>
        <TabsList>
          {sourceFileUrls.length > 0 && (
            <TabsTrigger value="drawings">
              <MapPin className="h-3.5 w-3.5 mr-1" />
              Annotated Drawings
            </TabsTrigger>
          )}
          <TabsTrigger value="bom">BOM Table ({items.length})</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {sourceFileUrls.length > 0 && (
          <TabsContent value="drawings">
            <AnnotatedDrawingViewer
              sourceFiles={sourceFileUrls}
              items={items}
              selectedItemId={selectedItemId}
              onItemSelect={setSelectedItemId}
            />
          </TabsContent>
        )}

        <TabsContent value="bom">
          <BOMTable
            items={items}
            onItemUpdated={refresh}
            highlightedItemId={selectedItemId}
            onItemSelect={setSelectedItemId}
          />
        </TabsContent>

        <TabsContent value="export">
          <ExportPanel project={project} items={items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
