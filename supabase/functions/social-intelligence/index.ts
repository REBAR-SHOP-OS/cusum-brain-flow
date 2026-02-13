import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BusinessInsightReport {
  generatedAt: string;
  recentOrders: { product: string; count: number; revenue: number }[];
  topLeads: { title: string; stage: string; value: number }[];
  customerQuestions: string[];
  searchConsole: { topQueries: { query: string; clicks: number; impressions: number; ctr: number }[]; totalClicks: number; totalImpressions: number } | null;
  analytics: { topPages: { page: string; views: number }[]; totalSessions: number } | null;
  socialPerformance: { platform: string; published: number; scheduled: number; avgEngagement: number }[];
  trendingSummary: string;
}

async function getGoogleAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  // Try per-user token first
  const { data: tokenData } = await supabase
    .from("user_gmail_tokens")
    .select("refresh_token, is_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenData?.refresh_token) {
    // Fallback to shared env token
    const shared = Deno.env.get("GMAIL_REFRESH_TOKEN");
    if (!shared) return null;
    return refreshGoogleToken(shared);
  }

  // If encrypted, decrypt first
  let refreshToken = tokenData.refresh_token;
  if (tokenData.is_encrypted) {
    try {
      const { decryptToken } = await import("../_shared/tokenEncryption.ts");
      refreshToken = await decryptToken(refreshToken);
    } catch {
      return null;
    }
  }

  return refreshGoogleToken(refreshToken);
}

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function fetchSearchConsoleData(accessToken: string): Promise<BusinessInsightReport["searchConsole"]> {
  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const res = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Arebar.shop/searchAnalytics/query",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["query"],
          rowLimit: 20,
        }),
      }
    );

    if (!res.ok) {
      // Try URL-based property
      const res2 = await fetch(
        "https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Frebar.shop%2F/searchAnalytics/query",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: 20 }),
        }
      );
      if (!res2.ok) return null;
      const data2 = await res2.json();
      return processSearchConsoleData(data2);
    }

    const data = await res.json();
    return processSearchConsoleData(data);
  } catch (e) {
    console.error("Search Console error:", e);
    return null;
  }
}

function processSearchConsoleData(data: any): BusinessInsightReport["searchConsole"] {
  const rows = data.rows || [];
  let totalClicks = 0;
  let totalImpressions = 0;
  const topQueries = rows.map((r: any) => {
    totalClicks += r.clicks || 0;
    totalImpressions += r.impressions || 0;
    return {
      query: r.keys?.[0] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 10000) / 100,
    };
  });
  return { topQueries, totalClicks, totalImpressions };
}

async function fetchAnalyticsData(accessToken: string): Promise<BusinessInsightReport["analytics"]> {
  try {
    // GA4 Data API
    const res = await fetch(
      "https://analyticsdata.googleapis.com/v1beta/properties/YOUR_GA4_PROPERTY:runReport",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
          limit: 10,
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const rows = data.rows || [];
    let totalSessions = 0;
    const topPages = rows.map((r: any) => {
      const views = parseInt(r.metricValues?.[0]?.value || "0");
      totalSessions += parseInt(r.metricValues?.[1]?.value || "0");
      return { page: r.dimensionValues?.[0]?.value || "", views };
    });
    return { topPages, totalSessions };
  } catch (e) {
    console.error("Analytics error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Accept either user auth or service role
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await userClient.auth.getClaims(token);
      userId = (data?.claims?.sub as string) || null;
    }

    // Gather business data in parallel
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [ordersRes, leadsRes, commsRes, postsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total_amount, status, created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("leads")
        .select("id, title, stage, expected_value, probability")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("communications")
        .select("subject, body_preview, ai_category")
        .gte("created_at", sevenDaysAgo)
        .eq("direction", "inbound")
        .limit(30),
      supabase
        .from("social_posts")
        .select("platform, status, likes, comments, shares, impressions, reach")
        .gte("created_at", thirtyDaysAgo),
    ]);

    // Process orders into product trends
    const orders = ordersRes.data || [];
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

    // Process leads
    const leads = (leadsRes.data || []).slice(0, 5).map((l: any) => ({
      title: l.title || "Untitled",
      stage: l.stage || "new",
      value: l.expected_value || 0,
    }));

    // Extract customer questions from communications
    const customerQuestions = (commsRes.data || [])
      .filter((c: any) => c.subject || c.body_preview)
      .slice(0, 10)
      .map((c: any) => c.subject || (c.body_preview || "").substring(0, 100));

    // Social performance breakdown
    const posts = postsRes.data || [];
    const platformStats: Record<string, { published: number; scheduled: number; totalEngagement: number; count: number }> = {};
    for (const p of posts) {
      if (!platformStats[p.platform]) {
        platformStats[p.platform] = { published: 0, scheduled: 0, totalEngagement: 0, count: 0 };
      }
      if (p.status === "published") platformStats[p.platform].published++;
      if (p.status === "scheduled") platformStats[p.platform].scheduled++;
      const engagement = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
      platformStats[p.platform].totalEngagement += engagement;
      platformStats[p.platform].count++;
    }

    const socialPerformance = Object.entries(platformStats).map(([platform, stats]) => ({
      platform,
      published: stats.published,
      scheduled: stats.scheduled,
      avgEngagement: stats.count > 0 ? Math.round(stats.totalEngagement / stats.count) : 0,
    }));

    // Fetch Google data if user has tokens
    let searchConsole: BusinessInsightReport["searchConsole"] = null;
    let analytics: BusinessInsightReport["analytics"] = null;

    if (userId) {
      const accessToken = await getGoogleAccessToken(supabase, userId);
      if (accessToken) {
        [searchConsole, analytics] = await Promise.all([
          fetchSearchConsoleData(accessToken),
          fetchAnalyticsData(accessToken),
        ]);
      }
    }

    // Build trending summary using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let trendingSummary = "";
    if (LOVABLE_API_KEY) {
      try {
        const summaryPrompt = `Based on this business data for Rebar.shop (rebar fabrication company in Ontario), write a 3-sentence business intelligence summary for social media content creation:
- ${orders.length} orders in last 30 days, total revenue: $${totalRevenue.toLocaleString()}
- Top leads: ${leads.map((l: any) => `${l.title} ($${l.value})`).join(", ")}
- Customer inquiries: ${customerQuestions.slice(0, 5).join("; ")}
- Search Console top queries: ${searchConsole?.topQueries?.slice(0, 5).map((q: any) => q.query).join(", ") || "N/A"}
- Social media: ${socialPerformance.map((s) => `${s.platform}: ${s.published} published`).join(", ")}

Focus on what content topics would resonate most and what products/services to highlight.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: summaryPrompt }],
            max_tokens: 300,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          trendingSummary = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI summary error:", e);
      }
    }

    const report: BusinessInsightReport = {
      generatedAt: new Date().toISOString(),
      recentOrders: [{ product: "All Products", count: orders.length, revenue: totalRevenue }],
      topLeads: leads,
      customerQuestions,
      searchConsole,
      analytics,
      socialPerformance,
      trendingSummary,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Social intelligence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
