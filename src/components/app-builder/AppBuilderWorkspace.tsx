import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppBuilderProject } from "@/hooks/useAppBuilderProject";
import { AppBuilderSidebar } from "./AppBuilderSidebar";
import { AppBuilderPromptBar } from "./AppBuilderPromptBar";
import { AppBuilderPlanView } from "./AppBuilderPlanView";
import { AppBuilderPagePlan } from "./AppBuilderPagePlan";
import { AppBuilderDataModel } from "./AppBuilderDataModel";
import { AppBuilderPreviewPanel } from "./AppBuilderPreviewPanel";
import { AppBuilderVersions } from "./AppBuilderVersions";
import { AppBuilderExport } from "./AppBuilderExport";
import { AppBuilderChat } from "./AppBuilderChat";
import { AppBuilderConnectors } from "./AppBuilderConnectors";
import { AppBuilderKnowledge } from "./AppBuilderKnowledge";
import { Badge } from "@/components/ui/badge";
import { useCallback } from "react";

function OverviewSection({ project }: { project: ReturnType<typeof useAppBuilderProject>["project"] }) {
  if (!project.plan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
          <span className="text-2xl">🏗️</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No plan yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Describe the app you want to build using the prompt above to generate an AI-powered plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{project.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 capitalize">{project.status}</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pages", value: project.plan.pages.length },
            { label: "Entities", value: project.plan.dataModel.length },
            { label: "Features", value: project.plan.features.mustHave.length + project.plan.features.secondary.length },
            { label: "Versions", value: project.versions.length },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold text-foreground mb-3">Settings</h3>
      <p className="text-sm text-muted-foreground">Project settings will be available here. Configure team access, naming, and export preferences.</p>
    </div>
  );
}

export function AppBuilderWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {
    project,
    activeSection,
    setActiveSection,
    isGenerating,
    generatePlan,
    selectedPreviewPage,
    setSelectedPreviewPage,
    // Chat
    messages,
    isChatLoading,
    sendMessage,
    // Mode
    mode,
    setMode,
    // Files
    pendingFiles,
    addFiles,
    removeFile,
  } = useAppBuilderProject(projectId);

  const handleDiagnose = useCallback(
    (prompt: string) => {
      setMode("chat");
      setActiveSection("chat");
      sendMessage(prompt);
    },
    [setMode, setActiveSection, sendMessage]
  );

  const renderCenter = () => {
    if (isGenerating) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Generating your app plan...</p>
        </div>
      );
    }

    switch (activeSection) {
      case "overview":
        return <OverviewSection project={project} />;
      case "plan":
        return project.plan ? <AppBuilderPlanView plan={project.plan} /> : <OverviewSection project={project} />;
      case "pages":
        return project.plan ? <AppBuilderPagePlan pages={project.plan.pages} /> : <OverviewSection project={project} />;
      case "data-model":
        return project.plan ? <AppBuilderDataModel entities={project.plan.dataModel} /> : <OverviewSection project={project} />;
      case "preview":
        return (
          <AppBuilderPreviewPanel
            selectedPage={selectedPreviewPage}
            onSelectPage={setSelectedPreviewPage}
            pageNames={project.plan?.pages.map((p) => p.name) ?? []}
          />
        );
      case "versions":
        return <AppBuilderVersions versions={project.versions} />;
      case "export":
        return <AppBuilderExport />;
      case "settings":
        return <SettingsSection />;
      case "chat":
        return <AppBuilderChat messages={messages} isLoading={isChatLoading} />;
      case "connectors":
        return <AppBuilderConnectors onDiagnose={handleDiagnose} />;
      case "knowledge":
        return <AppBuilderKnowledge />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Sidebar */}
      <AppBuilderSidebar active={activeSection} onSelect={setActiveSection} projectName={project.name} />

      {/* Center + optional right panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Back button */}
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/app-builder")} className="text-muted-foreground gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to projects
            </Button>
          </div>

          {/* Prompt bar */}
          <AppBuilderPromptBar
            onGenerate={generatePlan}
            onSendMessage={sendMessage}
            isGenerating={isGenerating}
            isChatLoading={isChatLoading}
            mode={mode}
            onModeChange={setMode}
            pendingFiles={pendingFiles}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
          />

          {/* Content */}
          {renderCenter()}
        </div>

        {/* Right preview panel — shown on non-preview sections when plan exists */}
        {activeSection !== "preview" && project.plan && (
          <div className="w-80 shrink-0 border-l border-border p-4 overflow-y-auto hidden xl:block">
            <AppBuilderPreviewPanel
              selectedPage={selectedPreviewPage}
              onSelectPage={setSelectedPreviewPage}
              pageNames={project.plan.pages.map((p) => p.name)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
