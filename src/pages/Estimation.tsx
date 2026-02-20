import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, LayoutGrid, DollarSign, Bot, Brain } from "lucide-react";
import ProjectList from "@/components/estimation/ProjectList";
import ProjectDetail from "@/components/estimation/ProjectDetail";
import TakeoffWizard from "@/components/estimation/TakeoffWizard";
import BidBoard from "@/components/estimation/BidBoard";
import GaugeChat from "@/components/estimation/GaugeChat";
import CoordinationDashboard from "@/components/estimation/CoordinationDashboard";

export default function Estimation() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("takeoffs");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["estimation_projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimation_projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const handleTakeoffComplete = (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: ["estimation_projects"] });
    setSelectedProject(projectId);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estimation Platform</h1>
        <p className="text-muted-foreground text-sm">AI-powered rebar takeoff, bid tracking & quoting</p>
      </div>

      {selectedProject ? (
        <ProjectDetail
          projectId={selectedProject}
          onBack={() => setSelectedProject(null)}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
            <TabsTrigger value="takeoffs" className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4" /> Takeoffs
            </TabsTrigger>
            <TabsTrigger value="bid_board" className="flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Bid Board
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex items-center gap-1.5">
              <Brain className="h-4 w-4" /> Learning
            </TabsTrigger>
            <TabsTrigger value="quote_engine" className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Quotes
            </TabsTrigger>
            <TabsTrigger value="gauge" className="flex items-center gap-1.5">
              <Bot className="h-4 w-4" /> Gauge AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="takeoffs">
            <ProjectList
              projects={projects as any}
              onSelectProject={setSelectedProject}
              onNewTakeoff={() => setWizardOpen(true)}
            />
          </TabsContent>

          <TabsContent value="bid_board">
            <BidBoard />
          </TabsContent>

          <TabsContent value="learning">
            <CoordinationDashboard />
          </TabsContent>

          <TabsContent value="quote_engine">
            <div className="rounded-lg border bg-card p-6 text-center">
              <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Quote Engine is available at{" "}
                <a href="/quote-engine" className="text-primary underline">
                  /quote-engine
                </a>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="gauge">
            <GaugeChat />
          </TabsContent>
        </Tabs>
      )}

      <TakeoffWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleTakeoffComplete}
      />
    </div>
  );
}
