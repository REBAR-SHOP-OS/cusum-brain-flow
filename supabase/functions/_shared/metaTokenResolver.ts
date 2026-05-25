// Shared Meta (Facebook/Instagram) token resolver.
// Stability rule: prefer the current user's token only if it is healthy.
// Otherwise transparently fall back to a same-company teammate with a healthy token.
// Healthy = row exists, has access_token, and is not locally expired.

const GRAPH_API = "https://graph.facebook.com/v21.0";

export type MetaPlatform = "facebook" | "instagram";

export interface MetaTokenRow {
  user_id: string;
  access_token: string;
  pages: Array<{ id: string; name: string }> | null;
  instagram_accounts: Array<{ id: string; username?: string; pageId: string }> | null;
  expires_at: string | null;
}

export interface ResolvedMetaToken {
  tokenOwnerUserId: string;
  accessToken: string;
  pages: Array<{ id: string; name: string }>;
  instagramAccounts: Array<{ id: string; username?: string; pageId: string }>;
  ownedByCurrentUser: boolean;
  source: "self" | "team";
}

function isHealthy(row: MetaTokenRow | null | undefined): row is MetaTokenRow {
  if (!row || !row.access_token) return false;
  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (Number.isFinite(exp) && exp <= Date.now()) return false;
  }
  return true;
}

/**
 * Optionally validate the token against Meta with a lightweight /me call.
 * Returns true if Meta accepts the token, false otherwise.
 */
export async function validateMetaTokenRemote(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH_API}/me?fields=id&access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.error) return false;
    return !!data?.id;
  } catch {
    return false;
  }
}

/**
 * Resolve a usable Meta token for the given platform.
 * Order: self (healthy) → same-company teammate (healthy).
 * Does not perform a network validation; caller may call validateMetaTokenRemote separately.
 */
export async function resolveMetaToken(
  supabaseAdmin: any,
  userId: string,
  platform: MetaPlatform,
): Promise<ResolvedMetaToken | null> {
  // 1. Try current user
  const { data: ownRow } = await supabaseAdmin
    .from("user_meta_tokens")
    .select("user_id, access_token, pages, instagram_accounts, expires_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (isHealthy(ownRow)) {
    return {
      tokenOwnerUserId: ownRow.user_id,
      accessToken: ownRow.access_token,
      pages: (ownRow.pages as any) || [],
      instagramAccounts: (ownRow.instagram_accounts as any) || [],
      ownedByCurrentUser: true,
      source: "self",
    };
  }

  // 2. Same-company teammate fallback
  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!ownerProfile?.company_id) return null;

  const { data: teammates } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("company_id", ownerProfile.company_id)
    .neq("user_id", userId);

  for (const tm of teammates || []) {
    const { data: tmRow } = await supabaseAdmin
      .from("user_meta_tokens")
      .select("user_id, access_token, pages, instagram_accounts, expires_at")
      .eq("user_id", tm.user_id)
      .eq("platform", platform)
      .maybeSingle();

    if (isHealthy(tmRow)) {
      return {
        tokenOwnerUserId: tmRow.user_id,
        accessToken: tmRow.access_token,
        pages: (tmRow.pages as any) || [],
        instagramAccounts: (tmRow.instagram_accounts as any) || [],
        ownedByCurrentUser: false,
        source: "team",
      };
    }
  }

  return null;
}
