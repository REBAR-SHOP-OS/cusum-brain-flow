/**
 * Shared authentication middleware for Edge Functions.
 * Centralizes JWT verification via getClaims() to eliminate duplication
 * and ensure every protected endpoint validates tokens consistently.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Concrete client type matching createClient(url, key) calls in edge functions. */
export type AppSupabaseClient = SupabaseClient<Record<string, unknown>, "public", Record<string, unknown>>;

export interface AuthResult {
  userId: string;
  userClient: AppSupabaseClient;
  serviceClient: AppSupabaseClient;
}

/**
 * Verify JWT from Authorization header using getClaims().
 * Returns userId + pre-configured Supabase clients.
 * Throws a Response (401) on failure — caller should catch and return it.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceKey);

  return {
    userId: user.id,
    userClient,
    serviceClient,
  };
}

/**
 * Optional auth — returns userId if valid token present, null otherwise.
 * Does NOT throw. Useful for endpoints that degrade gracefully.
 */
export async function optionalAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Optional auth returning full context (userId + userClient).
 * Does NOT throw. Returns null if no valid token.
 */
export async function optionalAuthFull(req: Request): Promise<{
  userId: string;
  userClient: ReturnType<typeof createClient>;
} | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return null;
    return { userId: user.id, userClient };
  } catch {
    return null;
  }
}

/** JSON response helper */
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
