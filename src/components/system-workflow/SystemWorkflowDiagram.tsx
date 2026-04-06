import { useCallback, useMemo, useState } from "react";
import type { NodeChange } from "@xyflow/react";
import {
  applyNodeChanges,
  ReactFlowProvider,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  getDiagnosticsMock,
  getRepairHandlersMock,
  getRepairStepsMock,
  getWorkflowRegistryMock,
} from "@/data/workflowDiagram.mock";
import type { DiagnosticIssue, WorkflowGraphBundle, WorkflowRegistry } from "@/types/workflowDiagram";
import { DiagramCanvas } from "@/components/system-workflow/DiagramCanvas";
import { InspectorPanel } from "@/components/system-workflow/InspectorPanel";
import { DiagnosticsPanel } from "@/components/system-workflow/DiagnosticsPanel";
import { LayerBreadcrumb } from "@/components/system-workflow/LayerBreadcrumb";
import { WorkflowToolbar } from "@/components/system-workflow/WorkflowToolbar";
import { FixButton } from "@/components/system-workflow/FixButton";
import { graphToReactFlow, type WorkflowFilterKey } from "@/lib/workflowDiagram/selectors";

type NavFrame = { graphId: string; title: string; parentModuleId?: string };

function deriveTitle(graph: WorkflowGraphBundle, registry: WorkflowRegistry, graphId: string) {
  if (graphId === "root") return "Full System Workflow";
  return graph.label || "Workflow";
}

export function SystemWorkflowDiagram() {
  const registry = useMemo(() => getWorkflowRegistryMock(), []);
  const diagnostics = useMemo(() => getDiagnosticsMock(), []);
  const repairHandlers = useMemo(() => getRepairHandlersMock(), []);

  const [nav, setNav] = useState<NavFrame[]>([{ graphId: "root", title: "Full System Workflow" }]);
  const graphId = nav[nav.length - 1]?.graphId ?? "root";
  const graph = registry.graphs[graphId] ?? registry.graphs.root;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<WorkflowFilterKey>>(new Set());

  const [nodePositionsByGraph, setNodePositionsByGraph] = useState<
    Record<string, Record<string, { x: number; y: number }>>
  >({});

  const graphWithPositions: WorkflowGraphBundle = useMemo(() => {
    const overrides = nodePositionsByGraph[graph.id] ?? {};
    return {
      ...graph,
      nodes: graph.nodes.map((n) => ({ ...n, position: overrides[n.id] ?? n.position })),
    };
  }, [graph, nodePositionsByGraph]);

  const view = useMemo(() => ({ query, filters }), [query, filters]);
  const rf = useMemo(
    () => graphToReactFlow({ registry, graph: graphWithPositions, view, selectedNodeId }),
    [registry, graphWithPositions, view, selectedNodeId],
  );

  const selectedModule = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = graphWithPositions.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;
    return registry.modules[node.moduleId] ?? null;
  }, [graphWithPositions.nodes, registry.modules, selectedNodeId]);

  const onNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
  }, []);

  const onNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = graphWithPositions.nodes.find((n) => n.id === nodeId);
      const mod = node ? registry.modules[node.moduleId] : null;
      if (!mod?.childGraphId) return;
      const child = registry.graphs[mod.childGraphId];
      if (!child) return;
      setSelectedNodeId(null);
      setInspectorOpen(false);
      setNav((prev) => [...prev, { graphId: child.id, title: deriveTitle(child, registry, child.id), parentModuleId: mod.id }]);
    },
    [graphWithPositions.nodes, registry],
  );

  const onBreadcrumbNavigate = useCallback((idx: number) => {
    setSelectedNodeId(null);
    setInspectorOpen(false);
    setNav((prev) => prev.slice(0, Math.max(1, idx + 1)));
  }, []);

  const onToggleFilter = useCallback((k: WorkflowFilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setInspectorOpen(false);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Persist only position changes per graph so drill-down retains layout edits.
      const positionChanges = changes.filter((c) => c.type === "position" || c.type === "dimensions");
      if (positionChanges.length === 0) return;

      const current = rf.nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })) as any[];
      const next = applyNodeChanges(changes, current);

      setNodePositionsByGraph((prev) => {
        const byGraph = { ...(prev[graph.id] ?? {}) };
        for (const n of next) {
          if (n?.id && n?.position) byGraph[n.id] = n.position;
        }
        return { ...prev, [graph.id]: byGraph };
      });
    },
    [graph.id, rf.nodes],
  );

  const activeIssueCount = useMemo(
    () => diagnostics.filter((i) => i.severity === "critical" || i.severity === "high").length,
    [diagnostics],
  );

  const onIssueInspect = useCallback(
    (issue: DiagnosticIssue) => {
      setDiagnosticsOpen(true);
      // Try to select the first affected module in the current graph, otherwise clear selection.
      const currentNode = graphWithPositions.nodes.find((n) => issue.affectedModuleIds.includes(n.moduleId));
      if (currentNode) {
        setSelectedNodeId(currentNode.id);
        setInspectorOpen(true);
      }
    },
    [graphWithPositions.nodes],
  );

  return (
    <ReactFlowProvider>
      <div className="relative min-h-0 flex-1">
        <DiagramCanvas
          nodes={rf.nodes}
          edges={rf.edges}
          onNodesChange={onNodesChange}
          onEdgesChange={() => {}}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={onPaneClick}
        />

        <div className="pointer-events-none absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
          <div className="pointer-events-auto rounded-xl border border-white/10 bg-slate-950/70 p-2 shadow-lg backdrop-blur-md">
            <LayerBreadcrumb stack={nav} onNavigate={onBreadcrumbNavigate} />
          </div>
          <div className="pointer-events-auto rounded-xl border border-white/10 bg-slate-950/70 p-2 shadow-lg backdrop-blur-md">
            <WorkflowToolbar
              query={query}
              onQueryChange={setQuery}
              filters={filters}
              onToggleFilter={onToggleFilter}
            />
          </div>
        </div>

        <FixButton
          active={activeIssueCount > 0}
          onClick={() => {
            setDiagnosticsOpen(true);
          }}
        />

        <InspectorPanel
          open={inspectorOpen && !!selectedModule}
          onOpenChange={setInspectorOpen}
          module={selectedModule}
          onOpenInternal={() => {
            if (!selectedModule?.childGraphId) return;
            const child = registry.graphs[selectedModule.childGraphId];
            if (!child) return;
            setSelectedNodeId(null);
            setInspectorOpen(false);
            setNav((prev) => [
              ...prev,
              { graphId: child.id, title: deriveTitle(child, registry, child.id), parentModuleId: selectedModule.id },
            ]);
          }}
        />

        <DiagnosticsPanel
          open={diagnosticsOpen}
          onOpenChange={setDiagnosticsOpen}
          registry={registry}
          issues={diagnostics}
          repairHandlers={repairHandlers}
          onInspectModuleId={(moduleId) => {
            const currentNode = graphWithPositions.nodes.find((n) => n.moduleId === moduleId);
            if (currentNode) {
              setSelectedNodeId(currentNode.id);
              setInspectorOpen(true);
            }
          }}
        />

        <div
          className={cn(
            "pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[10px] text-zinc-400 backdrop-blur-sm",
          )}
        >
          Drag nodes · Scroll/trackpad to zoom · Double-click node to drill down
        </div>
      </div>
    </ReactFlowProvider>
  );
}

