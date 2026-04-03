/**
 * Client-side activity logger — writes employee actions to activity_events.
 * Lightweight, fire-and-forget. Never blocks UI.
 */
import { supabase } from "@/integrations/supabase/client";

const COMPANY_ID = "a0000000-0000-0000-0000-000000000001";

// Debounce navigation logs to avoid duplicate rapid fires
let lastNavLog = "";
let lastNavTime = 0;

interface LogOptions {
  entityType: string;
  entityId?: string;
  eventType: string;
  description?: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

/**
 * Fire-and-forget activity log. Never throws.
 */
export async function logActivity(opts: LogOptions): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("activity_events").insert([{
      company_id: COMPANY_ID,
      entity_type: opts.entityType,
      entity_id: opts.entityId || crypto.randomUUID(),
      event_type: opts.eventType,
      description: opts.description ?? null,
      source: opts.source ?? "app",
      actor_id: user.id,
      actor_type: "user",
      metadata: (opts.metadata as any) ?? null,
      dedupe_key: `${user.id}:${opts.eventType}:${opts.entityId ?? ""}:${new Date().toISOString().slice(0, 16)}`,
    }]);
  } catch {
    // Non-critical — silently fail
  }
}

/**
 * Log a page navigation event. Debounced to 5s per unique path.
 */
export function logNavigation(path: string): void {
  const now = Date.now();
  if (path === lastNavLog && now - lastNavTime < 5000) return;
  lastNavLog = path;
  lastNavTime = now;

  // Map paths to human-readable page names
  const pageNames: Record<string, string> = {
    "/home": "Home",
    "/orders": "Orders",
    "/leads": "Leads",
    "/deliveries": "Deliveries",
    "/shopfloor/delivery-ops": "Deliveries",
    "/accounting": "Accounting",
    "/customers": "Customers",
    "/projects": "Projects",
    "/shop-floor": "Shop Floor",
    "/inventory": "Inventory",
    "/chat": "Vizzy Chat",
    "/brain": "Brain",
    "/settings": "Settings",
    "/ceo": "CEO Portal",
    "/social-media": "Social Media",
  };

  // Find matching page
  const matchedKey = Object.keys(pageNames).find(
    (key) => path === key || path.startsWith(key + "/")
  );
  const pageName = matchedKey ? pageNames[matchedKey] : path;

  logActivity({
    entityType: "page",
    entityId: path,
    eventType: "page_visit",
    description: `Visited ${pageName}`,
    metadata: { path },
    source: "app",
  });
}

/**
 * Log a data mutation (order update, lead change, etc).
 */
export function logMutation(
  entityType: string,
  entityId: string,
  action: string,
  details?: string
): void {
  logActivity({
    entityType,
    entityId,
    eventType: `${entityType}_${action}`,
    description: details ?? `${action} on ${entityType}`,
    source: "app",
  });
}

/**
 * Log an email send event.
 */
export function logEmailSend(to: string, subject: string): void {
  logActivity({
    entityType: "email",
    eventType: "email_sent",
    description: `Sent email to ${to}: ${subject}`,
    metadata: { to, subject },
    source: "app",
  });
}

/**
 * Log an agent interaction.
 */
export function logAgentInteraction(agentName: string, query: string): void {
  logActivity({
    entityType: "agent",
    eventType: "agent_query",
    description: `Asked ${agentName}: ${query.slice(0, 100)}`,
    metadata: { agent: agentName },
    source: "app",
  });
}
