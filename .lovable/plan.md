

# Fix LinkedIn Publishing for Team Members (zahra@rebar.shop)

## Problem
LinkedIn publishing uses "OWNER-ONLY" token policy — it only looks for a LinkedIn connection matching the current user's `user_id`. Since Zahra doesn't have her own LinkedIn OAuth connection, publishing fails with "LinkedIn not connected for your account."

Facebook and Instagram already have a "team fallback" pattern (lines 190-218) that finds a teammate's token when the owner doesn't have one. LinkedIn explicitly skips this.

## Fix

### File: `supabase/functions/social-publish/index.ts` (lines 663-672)

Replace the OWNER-ONLY lookup with team fallback logic:

```typescript
// OWNER-FIRST with team fallback
let connection = (await supabase
  .from("integration_connections")
  .select("config")
  .eq("user_id", userId)
  .eq("integration_id", "linkedin")
  .maybeSingle()).data;

if (!connection) {
  // Team fallback: find any teammate with a valid LinkedIn connection
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (ownerProfile?.company_id) {
    const { data: teammates } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("company_id", ownerProfile.company_id)
      .neq("user_id", userId);

    for (const tm of teammates || []) {
      const { data: tmConn } = await supabase
        .from("integration_connections")
        .select("config")
        .eq("user_id", tm.user_id)
        .eq("integration_id", "linkedin")
        .maybeSingle();
      if (tmConn) {
        const tmConfig = tmConn.config as { expires_at: number };
        if (tmConfig.expires_at > Date.now()) {
          connection = tmConn;
          console.log(`[social-publish] LinkedIn team fallback: using token from user ${tm.user_id}`);
          break;
        }
      }
    }
  }

  if (!connection) {
    return { error: "LinkedIn not connected for any team member. Please connect from Settings → Integrations." };
  }
}
```

### Also update: `supabase/functions/social-cron-publish/index.ts`
Apply the same team fallback pattern to the cron publisher's LinkedIn token resolution (~line 665-676).

## Result
- Zahra (and any team member) can publish to LinkedIn using the team's shared LinkedIn connection
- Same pattern already proven working for Facebook/Instagram
- Owner's own connection is still preferred when available

