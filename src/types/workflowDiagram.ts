export type WorkflowModuleKind = "layer" | "sublayer" | "component" | "subcomponent";

export type WorkflowLayerGroup =
  | "user_interface"
  | "app_auth"
  | "core_data_api"
  | "automation_signals"
  | "external_integrations"
  | "monitoring_health"
  | "fix_center";

export type ModuleStatus = "healthy" | "warning" | "error" | "unknown";

export type FlowEdgeKind = "data" | "event" | "api" | "webhook" | "user_action" | "job";

export type WorkflowModuleDetail = {
  id: string;
  name: string;
  kind: WorkflowModuleKind;
  group: WorkflowLayerGroup;
  description: string;
  parentId?: string;
  childModuleIds: string[];
  /** If set, the UI can drill into the module's internal workflow graph. */
  childGraphId?: string;

  inputs: string[];
  outputs: string[];
  dependencies: string[];
  events: string[];
  apis: string[];
  webhooks: string[];
  jobs: string[];
  databaseEntities: string[];

  healthStatus: ModuleStatus;
  lastUpdatedAt: string;
  errorCount: number;
  warningCount: number;
  logsSummary: string;
  suggestedActions: string[];

  apiInfo?: { baseUrl?: string; endpoints?: { method: string; path: string; notes?: string }[] };
  webhookInfo?: { inbound?: string[]; outbound?: string[] };
};

export type WorkflowGraphNodeDef = {
  id: string;
  moduleId: string;
  position: { x: number; y: number };
};

export type WorkflowGraphEdgeDef = {
  id: string;
  source: string;
  target: string;
  kind: FlowEdgeKind;
  label?: string;
};

export type WorkflowGraphBundle = {
  id: string;
  label: string;
  nodes: WorkflowGraphNodeDef[];
  edges: WorkflowGraphEdgeDef[];
};

export type WorkflowRegistry = {
  modules: Record<string, WorkflowModuleDetail>;
  graphs: Record<string, WorkflowGraphBundle>;
};

export type DiagnosticSeverity = "low" | "medium" | "high" | "critical";

export type DiagnosticCategory =
  | "detected_failures"
  | "broken_connections"
  | "unhealthy_modules"
  | "missing_configs"
  | "failing_jobs"
  | "api_errors"
  | "timeouts";

export type DiagnosticIssueAction = "view_details" | "inspect_source" | "retry" | "mark_resolved" | "fix_now";

export type DiagnosticIssue = {
  id: string;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  title: string;
  description: string;
  affectedModuleIds: string[];
  relatedEdgeIds?: string[];
  suggestedFixes: string[];
  actions: DiagnosticIssueAction[];
  lastDetectedAt: string;
};

export type RepairStep = {
  id: string;
  title: string;
  description?: string;
};

export type RepairResult = {
  ok: boolean;
  message: string;
};

export type RepairHandler = (args: { issue: DiagnosticIssue; registry: WorkflowRegistry }) => Promise<RepairResult>;

export type RepairHandlerRegistry = Partial<Record<DiagnosticCategory, RepairHandler>>;

