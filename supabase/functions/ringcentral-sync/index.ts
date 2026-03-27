import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

const RC_SERVER = "https://platform.ringcentral.com";

interface CallLogRecord {
  id: string;
  sessionId: string;
  startTime: string;
  duration: number;
  type: string;
  direction: string;
  action: string;
  result: string;
  from: { phoneNumber?: string; name?: string };
  to: { phoneNumber?: string; name?: string };
  recording?: {
    id: string;
    contentUri: string;
    type: string;
  };
}

interface MessageRecord {
  id: string;
  conversationId: string;
  creationTime: string;
  direction: string;
  type: string;
  readStatus: string;
  subject?: string;
  from: { phoneNumber?: string; name?: string };
  to: Array<{ phoneNumber?: string; name?: string }>;
}

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return user.id;
}

/**
 * Get an access token for the given user.
 * Priority:
 *   1. Per-user OAuth token from user_ringcentral_tokens
 *   2. Fallback to shared JWT credentials (for backward compat / auto-migration)
 */
async function getAccessTokenForUser(
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string> {
  // 1. Check per-user tokens
  const { data: tokenRow } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("refresh_token, access_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (tokenRow) {
    // Check if it's a JWT-migrated token
    if (tokenRow.refresh_token.startsWith("jwt:")) {
      const jwt = tokenRow.refresh_token.replace("jwt:", "");
      return await exchangeJwtToken(jwt);
    }

    // Check if current access token is still valid
    if (tokenRow.access_token && tokenRow.token_expires_at) {
      const expiresAt = new Date(tokenRow.token_expires_at);
      if (expiresAt > new Date(Date.now() + 60_000)) {
        return tokenRow.access_token;
      }
    }

    // Refresh using OAuth refresh token
    const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
    const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("RingCentral OAuth client credentials not configured");
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If refresh token is expired/revoked, clean up and treat as disconnected
      if (errorText.includes("invalid_grant") || errorText.includes("Token not found")) {
        console.warn("RingCentral refresh token expired, clearing stale tokens for user", userId);
        await supabaseAdmin
          .from("user_ringcentral_tokens")
          .delete()
          .eq("user_id", userId);
        throw new Error("not_connected");
      }
      throw new Error(`RingCentral token refresh failed: ${errorText}`);
    }

    const tokens = await response.json();

    // Update stored tokens
    await supabaseAdmin
      .from("user_ringcentral_tokens")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || tokenRow.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      })
      .eq("user_id", userId);

    return tokens.access_token;
  }

  // 2. Fallback: shared JWT credentials (auto-migrate if email matches)
  const jwt = Deno.env.get("RINGCENTRAL_JWT");
  if (!jwt) {
    throw new Error("not_connected");
  }

  const accessToken = await exchangeJwtToken(jwt);

  // Check if this JWT matches the user's email
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email?.toLowerCase();

  let rcEmail = "";
  try {
    const extRes = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (extRes.ok) {
      const extData = await extRes.json();
      rcEmail = (extData.contact?.email || "").toLowerCase();
    }
  } catch {
    // continue
  }

  if (rcEmail && userEmail && rcEmail !== userEmail) {
    throw new Error("not_connected");
  }

  // Auto-migrate: store for this user
  if (rcEmail && userEmail && rcEmail === userEmail) {
    await supabaseAdmin.from("user_ringcentral_tokens").upsert({
      user_id: userId,
      rc_email: rcEmail,
      refresh_token: `jwt:${jwt}`,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    }, { onConflict: "user_id" });
  }

  return accessToken;
}

async function exchangeJwtToken(jwt: string): Promise<string> {
  const clientId = Deno.env.get("RINGCENTRAL_JWT_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_JWT_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("RingCentral JWT app credentials not configured");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RingCentral JWT token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchCallLog(accessToken: string, dateFrom: string): Promise<CallLogRecord[]> {
  const params = new URLSearchParams({
    dateFrom,
    perPage: "100",
    view: "Detailed",
  });

  const response = await fetch(
    `${RC_SERVER}/restapi/v1.0/account/~/extension/~/call-log?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch call log: ${await response.text()}`);
  }

  const data = await response.json();
  return data.records || [];
}

async function fetchMessages(accessToken: string, dateFrom: string, messageType = "SMS"): Promise<MessageRecord[]> {
  const params = new URLSearchParams({
    dateFrom,
    perPage: "100",
    messageType,
  });

  const response = await fetch(
    `${RC_SERVER}/restapi/v1.0/account/~/extension/~/message-store?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${messageType} messages: ${await response.text()}`);
  }

  const data = await response.json();
  return data.records || [];
}

// ─── Account-level fetch functions (for company-wide CRON sync) ───

async function fetchWithPagination(url: string, accessToken: string, delayMs = 200): Promise<any[]> {
  const allRecords: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`RC API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    allRecords.push(...(data.records || []));

    nextUrl = data.navigation?.nextPage?.uri || null;
    if (nextUrl && delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return allRecords;
}

async function fetchCompanyCallLog(accessToken: string, dateFrom: string): Promise<any[]> {
  const params = new URLSearchParams({
    dateFrom,
    perPage: "250",
    view: "Detailed",
  });
  return fetchWithPagination(
    `${RC_SERVER}/restapi/v1.0/account/~/call-log?${params}`,
    accessToken
  );
}

async function fetchCompanyMessages(accessToken: string, dateFrom: string, messageType: string): Promise<any[]> {
  const params = new URLSearchParams({
    dateFrom,
    perPage: "250",
    messageType,
  });
  return fetchWithPagination(
    `${RC_SERVER}/restapi/v1.0/account/~/message-store?${params}`,
    accessToken
  );
}

async function fetchCompanyExtensions(accessToken: string): Promise<any[]> {
  return fetchWithPagination(
    `${RC_SERVER}/restapi/v1.0/account/~/extension?perPage=250&status=Enabled`,
    accessToken
  );
}

/**
 * Build a map of RC extensionId → user_id by matching extension emails to profile emails.
 */
async function buildExtensionUserMap(
  accessToken: string,
  companyId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  fallbackUserId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Fetch all RC extensions
  let extensions: any[] = [];
  try {
    extensions = await fetchCompanyExtensions(accessToken);
  } catch (e) {
    console.warn("Could not fetch company extensions, falling back to single-user mode:", e);
    return map;
  }

  // Get all company profiles
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email")
    .eq("company_id", companyId);

  const emailToUserId = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
  }

  for (const ext of extensions) {
    const extId = String(ext.id);
    const extEmail = (ext.contact?.email || "").toLowerCase();
    if (extEmail && emailToUserId.has(extEmail)) {
      map.set(extId, emailToUserId.get(extEmail)!);
    } else {
      map.set(extId, fallbackUserId); // attribute to admin if no match
    }
  }

  console.log(`Extension map: ${map.size} extensions mapped (${extensions.length} total, ${emailToUserId.size} profiles)`);
  return map;
}

function resolveUserId(record: any, extMap: Map<string, string>, fallbackUserId: string): string {
  // Account-level records include extension.id
  const extId = String(record.extension?.id || "");
  if (extId && extMap.has(extId)) return extMap.get(extId)!;
  return fallbackUserId;
}

/**
 * CRON MODE: Sync ALL company calls/SMS/voicemail/fax using account-level API.
 * Uses one admin token to fetch data for all extensions, then maps each record to the correct user.
 */
async function syncAllUsers(body: { syncType?: string; daysBack?: number }) {
  console.log("CRON: syncAllUsers started");
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const syncType = body.syncType || "all";
  const daysBack = body.daysBack || 1;
  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  console.log(`CRON: syncType=${syncType}, daysBack=${daysBack}, dateFrom=${dateFrom}`);

  // Get the first available RC token (admin user)
  const { data: tokenRows, error: tokErr } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("user_id")
    .limit(10);

  console.log(`CRON: Found ${tokenRows?.length ?? 0} token rows, error: ${tokErr?.message ?? "none"}`);

  if (tokErr || !tokenRows?.length) {
    console.log("CRON: No RC tokens found", tokErr?.message);
    return new Response(
      JSON.stringify({ cronMode: true, users_synced: 0, message: "No RC tokens found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Try to get a working access token from any available token row
  let accessToken: string | null = null;
  let adminUserId: string | null = null;
  let companyId: string | null = null;

  for (const row of tokenRows) {
    console.log(`CRON: Attempting token for user ${row.user_id}`);
    try {
      accessToken = await getAccessTokenForUser(row.user_id, supabaseAdmin);
      console.log(`CRON: Token acquired for user ${row.user_id}`);
      adminUserId = row.user_id;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", row.user_id)
        .maybeSingle();

      companyId = profile?.company_id || null;
      console.log(`CRON: companyId=${companyId} for user ${row.user_id}`);
      if (companyId) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      console.error(`CRON: Token for ${row.user_id} failed: ${msg}`);

      // Update integration status to "error" for ALL failure types so the UI flags it
      const errorMessage = (msg === "not_connected" || msg.includes("invalid_grant") || msg.includes("Token not found"))
        ? "Token expired — please reconnect"
        : `Sync error: ${msg.slice(0, 200)}`;

      await supabaseAdmin
        .from("integration_connections")
        .upsert({
          user_id: row.user_id,
          integration_id: "ringcentral",
          status: "error",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,integration_id" });

      continue;
    }
  }

  if (!accessToken || !adminUserId || !companyId) {
    console.log("CRON: Could not obtain a working RC token for any user");
    return new Response(
      JSON.stringify({ cronMode: true, users_synced: 0, message: "No working RC tokens" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`CRON: Using admin token from user ${adminUserId}, company ${companyId}`);

  // Build extension → user_id map
  console.log("CRON: Building extension→user map...");
  let extMap: Map<string, string>;
  try {
    extMap = await buildExtensionUserMap(accessToken, companyId, supabaseAdmin, adminUserId);
    console.log(`CRON: Extension map built with ${extMap.size} entries`);
  } catch (e) {
    console.error("CRON: FATAL - buildExtensionUserMap crashed:", e instanceof Error ? e.message : e);
    // Update status to error so UI shows it
    await supabaseAdmin.from("integration_connections").upsert({
      user_id: adminUserId,
      integration_id: "ringcentral",
      status: "error",
      error_message: `Extension map build failed: ${e instanceof Error ? e.message : "Unknown"}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,integration_id" });
    return new Response(
      JSON.stringify({ cronMode: true, users_synced: 0, message: "Extension map build failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let callsUpserted = 0, smsUpserted = 0, voicemailsUpserted = 0, faxesUpserted = 0;
  const usersSeen = new Set<string>();

  // ── Calls ──
  if (syncType === "calls" || syncType === "all") {
    try {
      const calls = await fetchCompanyCallLog(accessToken, dateFrom);
      console.log(`CRON: Fetched ${calls.length} account-level call records`);

      for (const call of calls) {
        const userId = resolveUserId(call, extMap, adminUserId);
        usersSeen.add(userId);

        const { error } = await supabaseAdmin.from("communications").upsert({
          source: "ringcentral", source_id: call.id, thread_id: call.sessionId,
          from_address: call.from?.phoneNumber || call.from?.name || "Unknown",
          to_address: call.to?.phoneNumber || call.to?.name || "Unknown",
          subject: `${call.direction} call - ${call.result}`,
          body_preview: `Duration: ${Math.floor((call.duration || 0) / 60)}m ${(call.duration || 0) % 60}s | ${call.action || ""}`,
          received_at: call.startTime, direction: (call.direction || "").toLowerCase(),
          status: call.result === "Missed" ? "unread" : "read",
          metadata: {
            type: "call", duration: call.duration || 0, action: call.action, result: call.result,
            ...(call.recording ? { recording_id: call.recording.id, recording_uri: call.recording.contentUri, recording_type: call.recording.type } : {}),
          },
          user_id: userId, company_id: companyId,
        }, { onConflict: "source,source_id", ignoreDuplicates: false });

        if (!error) {
          callsUpserted++;
          await supabaseAdmin.from("activity_events").upsert({
            entity_type: "communication", entity_id: call.id, event_type: "call_logged",
            actor_id: userId, actor_type: "system",
            description: `${call.direction} call ${call.from?.phoneNumber || "?"} → ${call.to?.phoneNumber || "?"}: ${call.result}`,
            company_id: companyId, source: "ringcentral", dedupe_key: `rc:${call.id}`,
            metadata: { direction: call.direction, result: call.result, duration: call.duration },
          }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        }
      }
    } catch (e) { console.warn("CRON: account-level call sync failed:", e); }
  }

  // ── SMS ──
  if (syncType === "sms" || syncType === "all") {
    try {
      const messages = await fetchCompanyMessages(accessToken, dateFrom, "SMS");
      console.log(`CRON: Fetched ${messages.length} account-level SMS records`);

      for (const msg of messages) {
        const userId = resolveUserId(msg, extMap, adminUserId);
        usersSeen.add(userId);
        const toAddress = msg.to?.map((t: any) => t.phoneNumber || t.name).join(", ") || "Unknown";

        const { error } = await supabaseAdmin.from("communications").upsert({
          source: "ringcentral", source_id: String(msg.id), thread_id: msg.conversationId,
          from_address: msg.from?.phoneNumber || msg.from?.name || "Unknown", to_address: toAddress,
          subject: msg.subject || "SMS", body_preview: msg.subject || "",
          received_at: msg.creationTime, direction: (msg.direction || "").toLowerCase(),
          status: msg.readStatus === "Unread" ? "unread" : "read",
          metadata: { type: "sms" }, user_id: userId, company_id: companyId,
        }, { onConflict: "source,source_id", ignoreDuplicates: false });
        if (!error) smsUpserted++;
      }
    } catch (e) { console.warn("CRON: account-level SMS sync failed:", e); }
  }

  // ── Voicemail ──
  if (syncType === "voicemail" || syncType === "all") {
    try {
      const voicemails = await fetchCompanyMessages(accessToken, dateFrom, "VoiceMail");
      console.log(`CRON: Fetched ${voicemails.length} account-level voicemail records`);

      for (const vm of voicemails) {
        const userId = resolveUserId(vm, extMap, adminUserId);
        usersSeen.add(userId);
        const toAddress = vm.to?.map((t: any) => t.phoneNumber || t.name).join(", ") || "Unknown";
        const vmAttachments = vm.attachments || [];

        const { error } = await supabaseAdmin.from("communications").upsert({
          source: "ringcentral", source_id: String(vm.id), thread_id: vm.conversationId,
          from_address: vm.from?.phoneNumber || vm.from?.name || "Unknown", to_address: toAddress,
          subject: "Voicemail", body_preview: vm.subject || "Voicemail message",
          received_at: vm.creationTime, direction: (vm.direction || "").toLowerCase(),
          status: vm.readStatus === "Unread" ? "unread" : "read",
          metadata: { type: "voicemail", duration: vm.vmDuration || 0, recording_uri: vmAttachments[0]?.uri || null, recording_id: vmAttachments[0]?.id || null },
          user_id: userId, company_id: companyId,
        }, { onConflict: "source,source_id", ignoreDuplicates: false });
        if (!error) voicemailsUpserted++;
      }
    } catch (e) { console.warn("CRON: account-level voicemail sync failed:", e); }
  }

  // ── Fax ──
  if (syncType === "fax" || syncType === "all") {
    try {
      const faxes = await fetchCompanyMessages(accessToken, dateFrom, "Fax");
      console.log(`CRON: Fetched ${faxes.length} account-level fax records`);

      for (const fax of faxes) {
        const userId = resolveUserId(fax, extMap, adminUserId);
        usersSeen.add(userId);
        const toAddress = fax.to?.map((t: any) => t.phoneNumber || t.name).join(", ") || "Unknown";
        const faxAttachments = (fax.attachments || []).map((a: any) => ({ id: a.id, uri: a.uri, type: a.contentType, name: a.fileName }));

        const { error } = await supabaseAdmin.from("communications").upsert({
          source: "ringcentral", source_id: String(fax.id), thread_id: fax.conversationId,
          from_address: fax.from?.phoneNumber || fax.from?.name || "Unknown", to_address: toAddress,
          subject: "Fax", body_preview: fax.subject || "Fax document",
          received_at: fax.creationTime, direction: (fax.direction || "").toLowerCase(),
          status: fax.readStatus === "Unread" ? "unread" : "read",
          metadata: { type: "fax", page_count: fax.pgCnt || 0, resolution: fax.faxResolution || "Standard", attachments: faxAttachments },
          user_id: userId, company_id: companyId,
        }, { onConflict: "source,source_id", ignoreDuplicates: false });
        if (!error) faxesUpserted++;
      }
    } catch (e) { console.warn("CRON: account-level fax sync failed:", e); }
  }

  // Mark integration as synced for ALL users with RC connections (not just those with new data)
  const { data: allRcConnections } = await supabaseAdmin
    .from("integration_connections")
    .select("user_id")
    .eq("integration_id", "ringcentral");

  const allRcUserIds = new Set<string>(
    (allRcConnections || []).map((r: any) => r.user_id)
  );
  // Ensure admin user is always included
  allRcUserIds.add(adminUserId);

  for (const uid of allRcUserIds) {
    await supabaseAdmin
      .from("integration_connections")
      .upsert({
        user_id: uid,
        integration_id: "ringcentral",
        status: "connected",
        error_message: null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,integration_id" });
  }

  const summary = { cronMode: true, accountLevel: true, users_synced: usersSeen.size, calls: callsUpserted, sms: smsUpserted, voicemails: voicemailsUpserted, faxes: faxesUpserted, dateFrom };
  console.log(`CRON: Account-level RC sync complete.`, JSON.stringify(summary));

  return new Response(
    JSON.stringify(summary),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  console.log("ringcentral-sync invoked", new Date().toISOString());

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    
    // Parse body early (needed for both modes)
    let body: { syncType?: string; daysBack?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Use defaults
    }

    // Try user JWT auth first
    const userId = await verifyAuth(req);

    if (!userId) {
      // No valid user JWT — check if this is a cron call (anon key or service role key)
      // Cron jobs use the anon key; we escalate internally via service role
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (token === anonKey || token === serviceKey) {
        console.log("CRON MODE: Syncing all RC users");
        return await syncAllUsers(body);
      }

      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // body already parsed above (before auth check)

    const syncType = body.syncType || "all";
    const daysBack = body.daysBack || 7;
    const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get access token for this specific user
    let accessToken: string;
    try {
      accessToken = await getAccessTokenForUser(userId, supabaseAdmin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg === "not_connected" || msg.includes("unauthorized_client") || msg.includes("JWT token exchange failed") || msg.includes("Unauthorized for this grant type")) {
        return new Response(
          JSON.stringify({
            error: "not_connected",
            message: "RingCentral is not connected for your account. Please connect it in Inbox settings.",
            callsUpserted: 0,
            smsUpserted: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    // Look up the user's company_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) {
      console.error("No company_id found for user", userId);
      return new Response(
        JSON.stringify({
          error: "no_company",
          message: "No company found for your account.",
          callsUpserted: 0,
          smsUpserted: 0,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let callsUpserted = 0;
    let smsUpserted = 0;
    let voicemailsUpserted = 0;
    let faxesUpserted = 0;

    // Sync calls
    if (syncType === "calls" || syncType === "all") {
      const calls = await fetchCallLog(accessToken, dateFrom);

      for (const call of calls) {
        const { error } = await supabaseAdmin
          .from("communications")
          .upsert({
            source: "ringcentral",
            source_id: call.id,
            thread_id: call.sessionId,
            from_address: call.from?.phoneNumber || call.from?.name || "Unknown",
            to_address: call.to?.phoneNumber || call.to?.name || "Unknown",
            subject: `${call.direction} call - ${call.result}`,
            body_preview: `Duration: ${Math.floor(call.duration / 60)}m ${call.duration % 60}s | ${call.action}`,
            received_at: call.startTime,
            direction: call.direction.toLowerCase(),
            status: call.result === "Missed" ? "unread" : "read",
            metadata: {
              type: "call",
              duration: call.duration,
              action: call.action,
              result: call.result,
              ...(call.recording ? {
                recording_id: call.recording.id,
                recording_uri: call.recording.contentUri,
                recording_type: call.recording.type,
              } : {}),
            },
            user_id: userId,
            company_id: companyId,
          }, {
            onConflict: "source,source_id",
            ignoreDuplicates: false,
          });

        if (!error) {
          callsUpserted++;
          // Write activity event
          await supabaseAdmin.from("activity_events").upsert({
            entity_type: "communication",
            entity_id: call.id,
            event_type: "call_logged",
            actor_id: userId,
            actor_type: "system",
            description: `${call.direction} call ${call.from?.phoneNumber || "?"} → ${call.to?.phoneNumber || "?"}: ${call.result}`,
            company_id: companyId,
            source: "ringcentral",
            dedupe_key: `rc:${call.id}`,
            metadata: { direction: call.direction, result: call.result, duration: call.duration },
          }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        }
      }
    }

    // Sync SMS
    if (syncType === "sms" || syncType === "all") {
      const messages = await fetchMessages(accessToken, dateFrom);

      for (const msg of messages) {
        const toAddress = msg.to?.map(t => t.phoneNumber || t.name).join(", ") || "Unknown";

        const { error } = await supabaseAdmin
          .from("communications")
          .upsert({
            source: "ringcentral",
            source_id: String(msg.id),
            thread_id: msg.conversationId,
            from_address: msg.from?.phoneNumber || msg.from?.name || "Unknown",
            to_address: toAddress,
            subject: msg.subject || "SMS",
            body_preview: msg.subject || "",
            received_at: msg.creationTime,
            direction: msg.direction.toLowerCase(),
            status: msg.readStatus === "Unread" ? "unread" : "read",
            metadata: {
              type: "sms",
            },
            user_id: userId,
            company_id: companyId,
          }, {
            onConflict: "source,source_id",
            ignoreDuplicates: false,
          });

        if (!error) {
          smsUpserted++;
          // Write activity event
          await supabaseAdmin.from("activity_events").upsert({
            entity_type: "communication",
            entity_id: String(msg.id),
            event_type: "sms_received",
            actor_id: userId,
            actor_type: "system",
            description: `SMS ${msg.direction} ${msg.from?.phoneNumber || "?"} → ${toAddress}`,
            company_id: companyId,
            source: "ringcentral",
            dedupe_key: `rc:${msg.id}`,
            metadata: { direction: msg.direction, type: "sms" },
          }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        }
      }
    }

    // Sync Voicemails
    if (syncType === "voicemail" || syncType === "all") {
      try {
        const voicemails = await fetchMessages(accessToken, dateFrom, "VoiceMail");
        for (const vm of voicemails) {
          const toAddress = vm.to?.map(t => t.phoneNumber || t.name).join(", ") || "Unknown";
          const vmAttachments = (vm as any).attachments || [];
          const { error } = await supabaseAdmin
            .from("communications")
            .upsert({
              source: "ringcentral",
              source_id: String(vm.id),
              thread_id: vm.conversationId,
              from_address: vm.from?.phoneNumber || vm.from?.name || "Unknown",
              to_address: toAddress,
              subject: "Voicemail",
              body_preview: vm.subject || "Voicemail message",
              received_at: vm.creationTime,
              direction: vm.direction.toLowerCase(),
              status: vm.readStatus === "Unread" ? "unread" : "read",
              metadata: {
                type: "voicemail",
                duration: (vm as any).vmDuration || 0,
                recording_uri: vmAttachments[0]?.uri || null,
                recording_id: vmAttachments[0]?.id || null,
              },
              user_id: userId,
              company_id: companyId,
            }, { onConflict: "source,source_id", ignoreDuplicates: false });

          if (!error) voicemailsUpserted++;
        }
      } catch (e) {
        console.warn("Voicemail sync skipped:", e);
      }
    }

    // Sync Faxes
    if (syncType === "fax" || syncType === "all") {
      try {
        const faxes = await fetchMessages(accessToken, dateFrom, "Fax");
        for (const fax of faxes) {
          const toAddress = fax.to?.map(t => t.phoneNumber || t.name).join(", ") || "Unknown";
          const faxAttachments = ((fax as any).attachments || []).map((a: any) => ({
            id: a.id,
            uri: a.uri,
            type: a.contentType,
            name: a.fileName,
          }));
          const { error } = await supabaseAdmin
            .from("communications")
            .upsert({
              source: "ringcentral",
              source_id: String(fax.id),
              thread_id: fax.conversationId,
              from_address: fax.from?.phoneNumber || fax.from?.name || "Unknown",
              to_address: toAddress,
              subject: "Fax",
              body_preview: fax.subject || "Fax document",
              received_at: fax.creationTime,
              direction: fax.direction.toLowerCase(),
              status: fax.readStatus === "Unread" ? "unread" : "read",
              metadata: {
                type: "fax",
                page_count: (fax as any).pgCnt || 0,
                resolution: (fax as any).faxResolution || "Standard",
                attachments: faxAttachments,
              },
              user_id: userId,
              company_id: companyId,
            }, { onConflict: "source,source_id", ignoreDuplicates: false });

          if (!error) faxesUpserted++;
        }
      } catch (e) {
        console.warn("Fax sync skipped:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        callsUpserted,
        smsUpserted,
        voicemailsUpserted,
        faxesUpserted,
        dateFrom,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RingCentral sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
