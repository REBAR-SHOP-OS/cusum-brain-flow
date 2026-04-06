/**
 * Shared graph metadata for static Architecture page and live System Flow canvas.
 * Paths are real repo locations — keep in sync when architecture changes.
 */
import type { LucideIcon } from "lucide-react";
import { Users, Webhook, Database, Globe, Bell } from "lucide-react";

export type ArchLayer = "input" | "core" | "output";

export type Accent = "cyan" | "emerald" | "violet" | "orange";

export type ArchitectureGraphNode = {
  id: string;
  label: string;
  hint: string;
  layer: ArchLayer;
  accent: Accent;
  large?: boolean;
  icon: LucideIcon;
  detail: { title: string; bullets: string[] };
  /** Default canvas position (React Flow coordinates) */
  position: { x: number; y: number };
};

export const ARCHITECTURE_GRAPH_NODES: ArchitectureGraphNode[] = [
  {
    id: "users",
    label: "People",
    hint: "App + login",
    layer: "input",
    accent: "cyan",
    icon: Users,
    position: { x: 40, y: 40 },
    detail: {
      title: "Browser & authentication",
      bullets: [
        "React routes and pages: src/App.tsx",
        "Supabase Auth session: src/lib/auth.tsx (signIn, signUp, onAuthStateChange)",
      ],
    },
  },
  {
    id: "automation",
    label: "Signals",
    hint: "Webhooks & jobs",
    layer: "input",
    accent: "emerald",
    icon: Webhook,
    position: { x: 40, y: 320 },
    detail: {
      title: "Incoming automation",
      bullets: [
        "RingCentral webhook: supabase/functions/ringcentral-webhook/index.ts",
        "Scheduled HTTP (pg_cron → ringcentral-sync): supabase/migrations/20260402002613_166b3c6e-8cb5-4057-9a82-5475e2635f83.sql",
      ],
    },
  },
  {
    id: "core",
    label: "Core",
    hint: "Data + APIs",
    layer: "core",
    accent: "orange",
    icon: Database,
    large: true,
    position: { x: 380, y: 160 },
    detail: {
      title: "Supabase (Postgres + Edge Functions)",
      bullets: [
        "PostgreSQL schema & data: supabase/migrations/",
        "Edge function wrapper: supabase/functions/_shared/requestHandler.ts",
        "Business logic in supabase/functions/*/index.ts (Stripe, social, Vizzy, QB, …)",
      ],
    },
  },
  {
    id: "integrations",
    label: "Partners",
    hint: "HTTP out",
    layer: "output",
    accent: "violet",
    icon: Globe,
    position: { x: 760, y: 40 },
    detail: {
      title: "Outbound integrations (examples)",
      bullets: [
        "Payments: supabase/functions/stripe-payment/index.ts",
        "Telephony sync: supabase/functions/ringcentral-sync (invoked by cron above)",
        "Social publish: supabase/functions/social-publish/index.ts",
      ],
    },
  },
  {
    id: "delivery",
    label: "You",
    hint: "UI + push",
    layer: "output",
    accent: "cyan",
    icon: Bell,
    position: { x: 760, y: 320 },
    detail: {
      title: "Responses & notifications",
      bullets: [
        "In-app UI: React + TanStack Query patterns across src/",
        "Push pipeline: DB trigger on notifications → supabase/functions/push-on-notify → send-push (see supabase/migrations/20260401224944_942b953a-d09b-4dbf-bdf5-96e2e2038df2.sql)",
      ],
    },
  },
];

export const ARCHITECTURE_GRAPH_EDGES: { id: string; source: string; target: string }[] = [
  { id: "e-users-core", source: "users", target: "core" },
  { id: "e-auto-core", source: "automation", target: "core" },
  { id: "e-core-int", source: "core", target: "integrations" },
  { id: "e-core-del", source: "core", target: "delivery" },
];

export const LAYER_LABELS: Record<ArchLayer | "all", string> = {
  all: "All layers",
  input: "Inputs",
  core: "Core",
  output: "Outputs",
};
