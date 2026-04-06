import { SystemWorkflowDiagram } from "@/components/system-workflow/SystemWorkflowDiagram";

export default function Architecture() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-4rem)]">
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Full System Workflow Diagram</h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          Drag nodes · Scroll/trackpad to zoom · Drag background to pan · Double-click to drill into internal maps
        </p>
      </header>
      <SystemWorkflowDiagram />
    </div>
  );
}