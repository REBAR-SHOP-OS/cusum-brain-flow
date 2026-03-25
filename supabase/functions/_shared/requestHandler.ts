/**
 * Shared request handler wrapper for edge functions.
 * Handles CORS, auth, company resolution, error catching in one place.
 * Purely additive — existing functions can opt-in one at a time.
 *
 * Usage:
 *   import { handleRequest } from "../_shared/requestHandler.ts";
 *   serve((req) => handleRequest(req, async (ctx) => {
 *     // ctx.userId, ctx.companyId, ctx.serviceClient, ctx.body are ready
 *     return { myData: 123 };
 *   }, { functionName: "my-function", requireCompany: true }));
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, optionalAuthFull } from "./auth.ts";
import { resolveCompanyId } from "./resolveCompany.ts";
import { createLogger } from "./structuredLog.ts";

type AppRole = "admin" | "sales" | "accounting" | "office" | "workshop" | "field" | "shop_supervisor" | "customer";

export interface RequestContext {
  req: Request;
  userId: string;
  companyId: string;
  serviceClient: ReturnType<typeof createClient>;
  userClient: ReturnType<typeof createClient> | null;
  body: Record<string, any>;
  log: ReturnType<typeof createLogger>;
}

export interface HandlerOptions {
  functionName: string;
  requireCompany?: boolean; // default true
  requireRole?: AppRole;
  requireAnyRole?: AppRole[];
  /** If true, the handler must return a Response object directly. Skips { ok, data } wrapping. */
  rawResponse?: boolean;
  /**
   * If false, the handler's return value is serialized as-is (no { ok, data } wrapping).
   * Useful for migrating legacy functions that have an established API contract.
   * Default: true (wraps in { ok: true, data: result }).
   */
  wrapResult?: boolean;
  /**
   * If false, the wrapper skips req.json() parsing and passes an empty body {}.
   * The handler can then call req.formData() or req.text() itself.
   * Default: true.
   */
  parseBody?: boolean;
}

/**
 * Wraps an edge function handler with standard boilerplate.
 * Returns a standardized { ok, data, error } JSON response.
 */
export async function handleRequest(
  req: Request,
  handler: (ctx: RequestContext) => Promise<unknown>,
  options: HandlerOptions,
): Promise<Response> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger(options.functionName);

  try {
    // Auth
    const { userId, userClient, serviceClient } = await requireAuth(req);
    log.info("Authenticated", { userId });

    // Company resolution
    let companyId = "";
    if (options.requireCompany !== false) {
      companyId = await resolveCompanyId(serviceClient, userId);
    }

    // Role check (if required)
    if (options.requireRole) {
      const { requireRole } = await import("./roleCheck.ts");
      await requireRole(serviceClient, userId, options.requireRole);
    }
    if (options.requireAnyRole?.length) {
      const { requireAnyRole } = await import("./roleCheck.ts");
      await requireAnyRole(serviceClient, userId, options.requireAnyRole);
    }

    // Parse body (skip if parseBody is false — e.g. FormData functions)
    let body: Record<string, any> = {};
    if (options.parseBody !== false && req.method !== "GET" && req.method !== "HEAD") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    // Execute handler
    const result = await handler({
      req,
      userId,
      companyId,
      serviceClient,
      userClient,
      body,
      log,
    });

    log.done("Success", { companyId });

    // If handler returned a Response, always pass it through directly
    if (result instanceof Response) {
      return result;
    }

    // Serialize result — legacy functions use wrapResult: false to preserve API shape
    const payload = options.wrapResult === false ? result : { ok: true, data: result };

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    // requireAuth / requireRole throw Response objects
    if (err instanceof Response) return err;

    const message = err instanceof Error ? err.message : String(err);
    log.error("Request failed", err);

    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
