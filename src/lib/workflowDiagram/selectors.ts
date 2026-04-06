import type { Edge, Node } from "@xyflow/react";
import type {
  FlowEdgeKind,
  ModuleStatus,
  WorkflowGraphBundle,
  WorkflowModuleDetail,
  WorkflowRegistry,
} from "@/types/workflowDiagram";

export type WorkflowFilterKey =
  | "errors"
  | "warnings"
  | "healthy"
  | "external"
  | "internal"
  | "data_flow"
  | "jobs";

export type WorkflowViewState = {
  query: string;
  filters: Set<WorkflowFilterKey>;
};

export function statusRank(status: ModuleStatus) {
  switch (status) {
    case "error":
      return 3;
    case "warning":
      return 2;
    case "healthy":
      return 1;
    default:
      return 0;
  }
}

export function matchesQuery(module: WorkflowModuleDetail, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    module.name.toLowerCase().includes(q) ||
    module.description.toLowerCase().includes(q) ||
    module.apis.some((x) => x.toLowerCase().includes(q)) ||
    module.webhooks.some((x) => x.toLowerCase().includes(q)) ||
    module.jobs.some((x) => x.toLowerCase().includes(q)) ||
    module.databaseEntities.some((x) => x.toLowerCase().includes(q))
  );
}

export function moduleMatchesFilters(module: WorkflowModuleDetail, filters: Set<WorkflowFilterKey>) {
  if (filters.size === 0) return true;

  const statusOk =
    (filters.has("errors") && module.healthStatus === "error") ||
    (filters.has("warnings") && module.healthStatus === "warning") ||
    (filters.has("healthy") && module.healthStatus === "healthy") ||
    (!filters.has("errors") && !filters.has("warnings") && !filters.has("healthy"));

  const externalOk =
    (filters.has("external") && module.group === "external_integrations") ||
    (filters.has("internal") && module.group !== "external_integrations") ||
    (!filters.has("external") && !filters.has("internal"));

  const dataOk =
    (filters.has("data_flow") && (module.apis.length > 0 || module.databaseEntities.length > 0 || module.events.length > 0)) ||
    !filters.has("data_flow");

  const jobsOk = (filters.has("jobs") && module.jobs.length > 0) || !filters.has("jobs");

  return statusOk && externalOk && dataOk && jobsOk;
}

export function edgeKindMatchesFilters(kind: FlowEdgeKind, filters: Set<WorkflowFilterKey>) {
  if (!filters.has("data_flow") && !filters.has("jobs")) return true;
  if (filters.has("jobs") && kind === "job") return true;
  if (filters.has("data_flow") && kind !== "job") return true;
  return false;
}

export function computeVisibility(args: {
  registry: WorkflowRegistry;
  graph: WorkflowGraphBundle;
  view: WorkflowViewState;
}) {
  const { registry, graph, view } = args;
  const nodeMatch = new Map<string, boolean>();

  for (const n of graph.nodes) {
    const m = registry.modules[n.moduleId];
    const ok = m ? matchesQuery(m, view.query) && moduleMatchesFilters(m, view.filters) : false;
    nodeMatch.set(n.id, ok);
  }

  // Expand visibility a bit: if an edge matches, keep its endpoints visible (dim instead of hide).
  const connected = new Set<string>();
  for (const e of graph.edges) {
    if (!edgeKindMatchesFilters(e.kind, view.filters)) continue;
    connected.add(e.source);
    connected.add(e.target);
  }

  const nodeVisible = new Map<string, boolean>();
  for (const n of graph.nodes) {
    const match = nodeMatch.get(n.id) ?? false;
    nodeVisible.set(n.id, match || connected.has(n.id));
  }

  const edgeVisible = new Map<string, boolean>();
  for (const e of graph.edges) {
    const srcOk = nodeVisible.get(e.source) ?? false;
    const tgtOk = nodeVisible.get(e.target) ?? false;
    edgeVisible.set(e.id, srcOk && tgtOk && edgeKindMatchesFilters(e.kind, view.filters));
  }

  return { nodeMatch, nodeVisible, edgeVisible };
}

export function graphToReactFlow(args: {
  registry: WorkflowRegistry;
  graph: WorkflowGraphBundle;
  view: WorkflowViewState;
  selectedNodeId: string | null;
}) {
  const { registry, graph, view, selectedNodeId } = args;
  const { nodeMatch, nodeVisible, edgeVisible } = computeVisibility({ registry, graph, view });

  const nodes: Node[] = graph.nodes.map((n) => {
    const m = registry.modules[n.moduleId];
    const match = nodeMatch.get(n.id) ?? false;
    const visible = nodeVisible.get(n.id) ?? true;
    const isSelected = selectedNodeId === n.id;

    return {
      id: n.id,
      type: "workflowNode",
      position: n.position,
      data: {
        moduleId: n.moduleId,
        title: m?.name ?? n.moduleId,
        subtitle: m?.kind ?? "component",
        group: m?.group ?? "core_data_api",
        status: m?.healthStatus ?? "unknown",
        hint:
          m?.logsSummary ??
          (m?.description ? m.description.slice(0, 80) : "No details available."),
        hasChildren: !!m?.childGraphId,
        errorCount: m?.errorCount ?? 0,
        warningCount: m?.warningCount ?? 0,
        dimmed: !match && visible,
        selected: isSelected,
      },
      hidden: !visible,
      selectable: true,
      draggable: true,
    } satisfies Node;
  });

  const edges: Edge[] = graph.edges.map((e) => {
    const visible = edgeVisible.get(e.id) ?? true;
    return {
      id: e.id,
      type: "connectionEdge",
      source: e.source,
      target: e.target,
      data: { kind: e.kind, label: e.label },
      hidden: !visible,
      animated: true,
    } satisfies Edge;
  });

  return { nodes, edges };
}

