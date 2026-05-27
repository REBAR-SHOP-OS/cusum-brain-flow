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
import { corsHeaders, requireAuth, optionalAuthFull, AppSupabaseClient } from "./auth.ts";
import { resolveCompanyId } from "./resolveCompany.ts";
import { createLogger } from "./structuredLog.ts";

type AppRole =
  | "admin"
  | "sales"
  | "accounting"
  | "office"
  | "workshop"
  | "field"
  | "shop_supervisor"
  | "customer"
  | "marketing";

export interface RequestContext {
  req: Request;
  userId: string;
  companyId: string;
  serviceClient: AppSupabaseClient;
  userClient: AppSupabaseClient | null;
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
   * Default: true (wraps in { ok: true, data: result }).
   */
  wrapResult?: boolean;
  /**
   * If false, the wrapper skips req.json() parsing and passes an empty body {}.
   * The handler can then call req.formData() or req.text() itself.
   * Default: true.
   */
  parseBody?: boolean;
  /**
   * Authentication mode:
   * - "required" (default): calls requireAuth(), throws 401 if no valid token
   * - "optional": resolves auth if Bearer token present, otherwise userId="" and userClient=null
   * - "none": skips auth entirely, only creates serviceClient
   */
  authMode?: "required" | "optional" | "none";
  /**
   * If true, the function is internal-only (cron/system).
   * Requires `x-internal-secret` header matching the INTERNAL_FUNCTION_SECRET env var.
   * Rejects unauthenticated callers with 403.
   */
  internalOnly?: boolean;
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
    // Internal-only guard — cron/system functions authenticate via Bearer token
    // matching the service role key (or its mirrored CRON_AUTH_TOKEN value),
    // OR via an authenticated admin user JWT (for manual UI triggers).
    // INTERNAL_FUNCTION_SECRET / x-internal-secret header are no longer used.
    if (options.internalOnly) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const cronToken = Deno.env.get("CRON_AUTH_TOKEN") || "";

      let authorized = false;
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        if (token === serviceKey || (cronToken && token === cronToken)) {
          authorized = true;
        } else {
          try {
            const tmp = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
            const { data } = await tmp.auth.getClaims(token);
            const uid = data?.claims?.sub as string | undefined;
            if (uid) {
              const svc = createClient(supabaseUrl, serviceKey);
              const { data: hasRole } = await svc.rpc("has_role", { _user_id: uid, _role: "admin" });
              if (hasRole === true) authorized = true;
            }
          } catch (e) {
            log.warn("internalOnly admin JWT check failed", { err: String(e) });
          }
        }
      }
      if (!authorized) {
        log.error("Internal endpoint unauthorized", { functionName: options.functionName });
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Auth — resolve based on authMode
    const authMode = options.authMode ?? "required";
    let userId = "";
    let userClient: AppSupabaseClient | null = null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    if (authMode === "required") {
      const auth = await requireAuth(req);
      userId = auth.userId;
      userClient = auth.userClient;
      log.info("Authenticated", { userId });
    } else if (authMode === "optional") {
      const auth = await optionalAuthFull(req);
      if (auth) {
        userId = auth.userId;
        userClient = auth.userClient;
        log.info("Authenticated (optional)", { userId });
      } else {
        log.info("Unauthenticated request (optional auth)");
      }
    } else {
      // authMode === "none"
      log.info("No auth (public endpoint)");
    }

    // Company resolution — skip when no userId
    let companyId = "";
    if (userId && options.requireCompany !== false) {
      companyId = await resolveCompanyId(serviceClient, userId);
    }

    // Role check (if required) — skip when no userId
    if (userId && options.requireRole) {
      const { requireRole } = await import("./roleCheck.ts");
      await requireRole(serviceClient, userId, options.requireRole);
    }
    if (userId && options.requireAnyRole?.length) {
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

    // If handler returned a Response, always pass it through directly
    if (result instanceof Response) {
      if (result.status >= 400) {
        log.error(`Handler returned error response (${result.status})`);
      } else {
        log.done("Success", { companyId });
      }
      return result;
    }

    log.done("Success", { companyId });

    // Serialize result — legacy functions use wrapResult: false to preserve API shape
    const payload = options.wrapResult === false ? result : { ok: true, data: result };

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    // requireAuth / requireRole throw Response objects
    if (err instanceof Response) {
      if (err.status === 401 || err.status === 403) {
        log.warn("Auth rejected", { status: err.status });
      }
      return err;
    }

    // Workflow-gate / override pass-through: when a DB trigger or the
    // workflow_override_transition RPC raises a WORKFLOW_GATE_* / WORKFLOW_OVERRIDE_*
    // error, preserve the code and surface as HTTP 409 so the client can react.
    const gate = mapWorkflowGateError(err);
    if (gate) {
      log.warn("Workflow gate rejected", { code: gate.code });
      return new Response(
        JSON.stringify({ ok: false, gate: true, code: gate.code, error: gate.error }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const message = err instanceof Error ? err.message : String(err);
    const explicitStatus = typeof (err as { status?: unknown })?.status === "number"
      ? Number((err as { status?: unknown }).status)
      : null;
    const normalizedMessage = message.toLowerCase();
    const inferredStatus =
      explicitStatus && explicitStatus >= 400 && explicitStatus <= 599
        ? explicitStatus
        : normalizedMessage.includes("ai credits exhausted") || normalizedMessage.includes("credits exhausted") || normalizedMessage.includes("payment required")
          ? 402
          : normalizedMessage.includes("rate limited") || normalizedMessage.includes("rate limit exceeded")
            ? 429
            : normalizedMessage.includes("forbidden")
              ? 403
              : normalizedMessage.includes("unauthorized") || normalizedMessage.includes("invalid token")
                ? 401
                : 500;

    log.error("Request failed", err);

    // For recoverable business errors (402 credits exhausted, 429 rate limit),
    // return HTTP 200 with the error embedded in the body. This prevents the
    // Lovable preview environment from escalating these expected business
    // outcomes into "RUNTIME_ERROR" overlays / blank screens. Clients still
    // see { ok:false, status, error } and can show a proper toast.
    const isRecoverableSoftError = inferredStatus === 402 || inferredStatus === 429;
    const responseStatus = isRecoverableSoftError ? 200 : inferredStatus;

    return new Response(
      JSON.stringify({ ok: false, error: message, status: inferredStatus }),
      { status: responseStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
