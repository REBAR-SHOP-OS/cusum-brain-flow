/**
 * Daily LinkedIn token health cron.
 *
 * 1. Refresh tokens proactively when expires_at < now + 7 days and refresh_token exists.
 * 2. Flip status='error' with a precise error_message for connections that:
 *    - are already expired and have no refresh_token, OR
 *    - are missing required scopes (offline_access, w_organization_social, r_organization_social).
 *
 * This stops scheduled posts from queueing on a connection that is provably dead,
 * and surfaces the real "reconnect required" message in Integrations before publish time.
 */
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

const REQUIRED_SCOPES = ["offline_access", "w_organization_social", "r_organization_social"];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type LinkedInConfig = {
  access_token?: string;
  expires_at?: number;
  refresh_token?: string | null;
  scope?: string;
  organization_ids?: Record<string, string>;
  profile_name?: string;
};

function scopeSet(scope?: string): Set<string> {
  return new Set((scope || "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
}

function missingScopes(scope?: string): string[] {
  const set = scopeSet(scope);
  if (set.size === 0) return [];
  return REQUIRED_SCOPES.filter((s) => !set.has(s));
}

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: supabase }) => {
    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
    const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("LINKEDIN_CLIENT_ID/SECRET not configured");
    }

    const { data: rows, error } = await supabase
      .from("integration_connections")
      .select("user_id, status, config, error_message")
      .eq("integration_id", "linkedin");

    if (error) throw new Error(`Failed to load linkedin connections: ${error.message}`);

    const now = Date.now();
    const summary: Array<Record<string, unknown>> = [];

    for (const row of (rows || []) as Array<{
      user_id: string;
      status: string;
      config: LinkedInConfig;
      error_message: string | null;
    }>) {
      const cfg = row.config || {};
      const expiresAt = cfg.expires_at || 0;
      const hasRefresh = !!cfg.refresh_token;
      const dropped = missingScopes(cfg.scope);
      const orgCount = Object.keys(cfg.organization_ids || {}).length;

      // CASE A: token will expire within 7 days AND we can refresh — refresh now.
      if (hasRefresh && expiresAt - now < SEVEN_DAYS_MS) {
        try {
          const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: cfg.refresh_token!,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          });
          if (res.ok) {
            const tok = await res.json();
            const newCfg: LinkedInConfig = {
              ...cfg,
              access_token: tok.access_token,
              expires_at: Date.now() + (tok.expires_in * 1000),
              ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
            };
            await supabase
              .from("integration_connections")
              .update({
                config: newCfg,
                status: "connected",
                error_message: null,
                last_sync_at: new Date().toISOString(),
              })
              .eq("user_id", row.user_id)
              .eq("integration_id", "linkedin");
            summary.push({ user_id: row.user_id, action: "refreshed" });
            continue;
          }
          const txt = await res.text();
          console.warn(`[linkedin-token-health] refresh failed for ${row.user_id}: ${res.status} ${txt}`);
        } catch (e) {
          console.warn(`[linkedin-token-health] refresh exception for ${row.user_id}:`, e);
        }
      }

      // CASE B: connection has a real problem — classify by severity.
      // FATAL: no access_token, OR expired with no refresh path → status=error.
      // DEGRADED: only optional scopes missing (e.g. offline_access / org scopes) →
      //   keep status=connected so personal posting keeps working; record warning.
      const fatalReasons: string[] = [];
      const warnReasons: string[] = [];
      if (!cfg.access_token) fatalReasons.push("no access token is stored");
      if (expiresAt < now && !hasRefresh) {
        fatalReasons.push("token expired and no refresh_token (LinkedIn App missing 'Sign In with LinkedIn using OpenID Connect' / offline_access scope) — Reconnect required");
      }
      if (dropped.length > 0) {
        warnReasons.push(`LinkedIn App missing optional scope(s): ${dropped.join(", ")} — request 'Sign In with LinkedIn using OpenID Connect' + 'Community Management API' in the LinkedIn Developer Portal, then Reconnect to unlock auto-refresh and company-page publishing`);
      }
      if (dropped.includes("r_organization_social") || dropped.includes("w_organization_social")) {
        if (orgCount === 0) warnReasons.push("no LinkedIn company pages discovered — only personal publishing is available");
      }

      if (fatalReasons.length > 0) {
        const msg = `Reconnect LinkedIn from Settings → Integrations (${[...fatalReasons, ...warnReasons].join("; ")}).`;
        if (row.status !== "error" || row.error_message !== msg) {
          await supabase
            .from("integration_connections")
            .update({ status: "error", error_message: msg })
            .eq("user_id", row.user_id)
            .eq("integration_id", "linkedin");
        }
        summary.push({ user_id: row.user_id, action: "flagged_error", reasons: fatalReasons.concat(warnReasons) });
        continue;
      }

      if (warnReasons.length > 0) {
        const warnMsg = warnReasons.join("; ");
        if (row.status !== "connected" || row.error_message !== warnMsg) {
          await supabase
            .from("integration_connections")
            .update({ status: "connected", error_message: warnMsg })
            .eq("user_id", row.user_id)
            .eq("integration_id", "linkedin");
        }
        summary.push({ user_id: row.user_id, action: "degraded_warning", reasons: warnReasons });
        continue;
      }

      summary.push({ user_id: row.user_id, action: "healthy", expires_in_days: Math.round((expiresAt - now) / 86400000) });
    }

    return new Response(
      JSON.stringify({ ok: true, processed: summary.length, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }, {
    functionName: "linkedin-token-health",
    authMode: "none",
    requireCompany: false,
    wrapResult: false,
    internalOnly: true,
  })
);
