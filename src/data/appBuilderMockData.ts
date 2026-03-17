export interface AppBuilderProject {
  id: string;
  name: string;
  description: string;
  status: "draft" | "planning" | "ready" | "exported";
  updatedAt: string;
  createdAt: string;
  plan: AppPlan | null;
  versions: AppVersion[];
}

export interface AppPlan {
  summary: string;
  businessGoal: string;
  targetUsers: string;
  keyWorkflows: string[];
  roles: string[];
  suggestedIntegrations: string[];
  features: FeaturePlan;
  pages: PagePlan[];
  dataModel: EntityPlan[];
  buildReadiness: BuildReadiness;
}

export interface FeaturePlan {
  mustHave: string[];
  secondary: string[];
  future: string[];
}

export interface PagePlan {
  name: string;
  purpose: string;
  components: string[];
  actions: string[];
}

export interface EntityPlan {
  name: string;
  fields: { name: string; type: string; note?: string }[];
  relationships: string[];
}

export interface AppVersion {
  id: string;
  version: number;
  timestamp: string;
  summary: string;
  isCurrent: boolean;
}

export interface BuildReadiness {
  complexity: "low" | "medium" | "high";
  screenCount: number;
  recommendation: string;
}

export const SAMPLE_PROJECT: AppBuilderProject = {
  id: "contractor-crm",
  name: "Contractor CRM",
  description: "End-to-end CRM for contractors: leads, estimates, jobs, and invoicing.",
  status: "ready",
  updatedAt: "2026-03-17T10:30:00Z",
  createdAt: "2026-03-15T08:00:00Z",
  plan: {
    summary:
      "A full-featured CRM designed for contractors and trade businesses. Manage customers, track leads through a pipeline, create estimates, schedule jobs, and send invoices — all from a single dashboard.",
    businessGoal: "Replace spreadsheets and disconnected tools with one unified platform that grows revenue and reduces admin overhead.",
    targetUsers: "Small to mid-size contractors, electricians, plumbers, HVAC companies, and general contractors.",
    keyWorkflows: [
      "Lead capture → qualification → estimate → job → invoice",
      "Customer communication log",
      "Job scheduling with calendar view",
      "Automated follow-ups on overdue invoices",
    ],
    roles: ["Admin", "Sales Rep", "Project Manager", "Field Technician"],
    suggestedIntegrations: ["QuickBooks", "Google Calendar", "Stripe", "Twilio SMS"],
    features: {
      mustHave: [
        "Lead pipeline with drag-and-drop stages",
        "Customer database with contact history",
        "Estimate builder with line items",
        "Job scheduling and status tracking",
        "Invoice generation and payment tracking",
      ],
      secondary: [
        "Email templates for follow-ups",
        "Dashboard analytics and KPIs",
        "File attachments on jobs",
        "Role-based access control",
      ],
      future: [
        "Mobile app for field technicians",
        "GPS tracking for job sites",
        "AI-powered lead scoring",
        "Customer portal for approvals",
      ],
    },
    pages: [
      {
        name: "Dashboard",
        purpose: "Overview of business health — revenue, pipeline, upcoming jobs",
        components: ["Stat cards", "Revenue chart", "Pipeline summary", "Upcoming jobs list"],
        actions: ["Filter by date range", "Quick-create lead", "Export report"],
      },
      {
        name: "Customers",
        purpose: "Manage customer records and communication history",
        components: ["Data table", "Search & filters", "Customer detail drawer", "Activity timeline"],
        actions: ["Add customer", "Edit details", "Log communication", "View jobs"],
      },
      {
        name: "Leads",
        purpose: "Track and convert leads through pipeline stages",
        components: ["Kanban board", "Lead cards", "Stage filters", "Conversion stats"],
        actions: ["Add lead", "Move between stages", "Convert to estimate", "Archive"],
      },
      {
        name: "Projects",
        purpose: "Schedule, assign, and track active jobs",
        components: ["Job list with status", "Calendar view", "Assignment panel", "Progress bar"],
        actions: ["Create job from estimate", "Assign team", "Update status", "Add notes"],
      },
      {
        name: "Invoices",
        purpose: "Generate and track invoices and payments",
        components: ["Invoice list", "Status badges", "Payment tracker", "Overdue alerts"],
        actions: ["Create invoice", "Send to customer", "Record payment", "Send reminder"],
      },
    ],
    dataModel: [
      {
        name: "Customer",
        fields: [
          { name: "id", type: "UUID", note: "Primary key" },
          { name: "name", type: "text" },
          { name: "email", type: "text" },
          { name: "phone", type: "text" },
          { name: "company", type: "text" },
          { name: "address", type: "text" },
          { name: "created_at", type: "timestamp" },
        ],
        relationships: ["Has many Leads", "Has many Projects", "Has many Invoices"],
      },
      {
        name: "Lead",
        fields: [
          { name: "id", type: "UUID" },
          { name: "customer_id", type: "FK → Customer" },
          { name: "title", type: "text" },
          { name: "stage", type: "enum", note: "new | qualified | proposal | won | lost" },
          { name: "value", type: "decimal" },
          { name: "source", type: "text" },
          { name: "created_at", type: "timestamp" },
        ],
        relationships: ["Belongs to Customer", "Can convert to Project"],
      },
      {
        name: "Project",
        fields: [
          { name: "id", type: "UUID" },
          { name: "customer_id", type: "FK → Customer" },
          { name: "lead_id", type: "FK → Lead", note: "Optional" },
          { name: "name", type: "text" },
          { name: "status", type: "enum", note: "scheduled | in_progress | complete" },
          { name: "start_date", type: "date" },
          { name: "end_date", type: "date" },
          { name: "budget", type: "decimal" },
        ],
        relationships: ["Belongs to Customer", "Has many Invoices", "Originated from Lead"],
      },
      {
        name: "Invoice",
        fields: [
          { name: "id", type: "UUID" },
          { name: "project_id", type: "FK → Project" },
          { name: "customer_id", type: "FK → Customer" },
          { name: "amount", type: "decimal" },
          { name: "status", type: "enum", note: "draft | sent | paid | overdue" },
          { name: "due_date", type: "date" },
          { name: "paid_at", type: "timestamp", note: "Nullable" },
        ],
        relationships: ["Belongs to Project", "Belongs to Customer"],
      },
      {
        name: "User",
        fields: [
          { name: "id", type: "UUID" },
          { name: "name", type: "text" },
          { name: "email", type: "text" },
          { name: "role", type: "enum", note: "admin | sales | pm | tech" },
          { name: "avatar_url", type: "text" },
        ],
        relationships: ["Assigned to Projects", "Creates Leads"],
      },
    ],
    buildReadiness: {
      complexity: "medium",
      screenCount: 12,
      recommendation: "Start with MVP: Dashboard, Customers, and Leads. Add Projects and Invoices in phase 2.",
    },
  },
  versions: [
    { id: "v1", version: 1, timestamp: "2026-03-15T08:00:00Z", summary: "Initial plan generated from prompt", isCurrent: false },
    { id: "v2", version: 2, timestamp: "2026-03-16T14:20:00Z", summary: "Added invoice module and payment tracking", isCurrent: false },
    { id: "v3", version: 3, timestamp: "2026-03-17T10:30:00Z", summary: "Refined data model, added role-based access", isCurrent: true },
  ],
};

export const EMPTY_PROJECT: AppBuilderProject = {
  id: "",
  name: "",
  description: "",
  status: "draft",
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  plan: null,
  versions: [],
};

export const TEMPLATE_PROJECTS: { name: string; description: string; icon: string }[] = [
  { name: "SaaS Dashboard", description: "Analytics and user management for a SaaS product", icon: "📊" },
  { name: "E-Commerce Store", description: "Product catalog, cart, and checkout flow", icon: "🛒" },
  { name: "Project Tracker", description: "Team task management with boards and timelines", icon: "📋" },
];

export interface ConnectorDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "connected" | "disconnected" | "error";
  diagnosticPrompt: string;
}

export const CONNECTORS: ConnectorDef[] = [
  {
    id: "rebar-shop",
    name: "rebar.shop",
    description: "WordPress storefront — product catalog, orders, and frontend",
    icon: "🌐",
    status: "connected",
    diagnosticPrompt: "Run a full diagnostic on rebar.shop — check homepage, products, header, footer, and report any issues.",
  },
  {
    id: "erp",
    name: "ERP System",
    description: "Rebar Shop OS — production, sales, accounting, and operations",
    icon: "🏭",
    status: "connected",
    diagnosticPrompt: "Check the ERP system health — verify database connectivity, recent activity, and any outstanding errors.",
  },
  {
    id: "odoo",
    name: "Odoo",
    description: "Inventory, purchasing, and warehouse management",
    icon: "📦",
    status: "disconnected",
    diagnosticPrompt: "Check Odoo connection status and verify inventory sync is working.",
  },
];
