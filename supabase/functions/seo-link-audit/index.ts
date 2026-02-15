import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WPClient } from "../_shared/wpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RSIC_RESOURCES = [
  { keywords: ["standard practice", "bar placing", "placing standard"], href: "https://rebar.org/manual-of-standard-practice/", anchor: "Manual of Standard Practice" },
  { keywords: ["reinforcing steel", "rebar industry", "steel reinforcement"], href: "https://rebar.org/", anchor: "Reinforcing Steel Institute of Canada" },
  { keywords: ["certification", "quality assurance", "certified"], href: "https://rebar.org/certification/", anchor: "RSIC Certification Program" },
  { keywords: ["bar supports", "bar chairs", "support system"], href: "https://rebar.org/bar-supports/", anchor: "RSIC Bar Supports Guide" },
  { keywords: ["epoxy coated", "corrosion protection", "epoxy-coated"], href: "https://rebar.org/epoxy-coated-rebar/", anchor: "Epoxy-Coated Reinforcing Steel" },
  { keywords: ["detailing", "bar bending schedule", "bending schedule"], href: "https://rebar.org/manual-of-standard-practice/", anchor: "Standard Detailing Practice" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phase, domain_id, company_id, audit_ids } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    if (phase === "crawl") {
      return await handleCrawl(sb, domain_id, company_id);
    } else if (phase === "fix") {
      return await handleFix(sb, audit_ids, company_id);
    }

    return new Response(JSON.stringify({ error: "Invalid phase" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-link-audit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── CRAWL PHASE ───

async function handleCrawl(sb: any, domainId: string, companyId: string) {
  const wp = new WPClient();

  // Clear previous audit for this domain
  await sb.from("seo_link_audit").delete().eq("domain_id", domainId);

  // Fetch all content from WordPress
  const [pages, posts, products] = await Promise.all([
    fetchAllWP(wp, "pages"),
    fetchAllWP(wp, "posts"),
    fetchAllWPProducts(wp),
  ]);

  const allContent = [...pages, ...posts, ...products];
  console.log(`Crawling ${allContent.length} pages/posts/products`);

  const results: any[] = [];
  const siteUrl = Deno.env.get("WP_BASE_URL")?.replace(/\/wp-json\/wp\/v2\/?$/, "") || "";

  for (const item of allContent) {
    const pageUrl = item.link || `${siteUrl}/?p=${item.id}`;
    const html = item.content?.rendered || "";
    if (!html) continue;

    // Extract links from HTML
    const links = extractLinks(html);

    for (const link of links) {
      const record: any = {
        domain_id: domainId,
        page_url: pageUrl,
        link_href: link.href,
        anchor_text: link.text || null,
        company_id: companyId,
      };

      // Classify link
      if (!link.href || link.href.startsWith("#") || link.href.startsWith("mailto:") || link.href.startsWith("tel:")) {
        continue;
      }

      const isInternal = link.href.startsWith("/") || (siteUrl && link.href.includes(new URL(siteUrl).hostname));
      record.link_type = isInternal ? "internal" : "external";

      // Check status
      if (!link.text || link.text.trim() === "") {
        record.status = "missing_anchor";
        record.suggestion = "Add descriptive anchor text for SEO";
      } else {
        // Try HEAD request to check for broken links
        try {
          const headRes = await fetch(link.href.startsWith("/") ? `${siteUrl}${link.href}` : link.href, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(5000),
          });
          if (headRes.status >= 400) {
            record.status = "broken";
            record.suggestion = `Link returns ${headRes.status}. Fix or remove.`;
          } else {
            record.status = "ok";
          }
        } catch {
          record.status = "broken";
          record.suggestion = "Link unreachable or timed out";
        }
      }

      results.push(record);
    }

    // AI-powered RSIC opportunity detection
    const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
    const existingHrefs = links.map((l) => l.href);

    let rsicCount = 0;
    for (const resource of RSIC_RESOURCES) {
      if (rsicCount >= 2) break;
      if (existingHrefs.some((h) => h && h.includes("rebar.org"))) break;

      const matched = resource.keywords.some((kw) => textContent.includes(kw));
      if (matched) {
        results.push({
          domain_id: domainId,
          page_url: pageUrl,
          link_href: null,
          anchor_text: null,
          link_type: "rsic_opportunity",
          status: "opportunity",
          suggestion: `Add outbound link to "${resource.anchor}" — keyword match found in content`,
          suggested_href: resource.href,
          suggested_anchor: resource.anchor,
          company_id: companyId,
        });
        rsicCount++;
      }
    }
  }

  // Batch insert
  if (results.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const { error } = await sb.from("seo_link_audit").insert(batch);
      if (error) console.error("Insert error:", error.message);
    }
  }

  const stats = {
    total: results.length,
    broken: results.filter((r) => r.status === "broken").length,
    opportunities: results.filter((r) => r.status === "opportunity").length,
    missing_anchor: results.filter((r) => r.status === "missing_anchor").length,
    ok: results.filter((r) => r.status === "ok").length,
  };

  return new Response(JSON.stringify({ success: true, stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── FIX PHASE ───

async function handleFix(sb: any, auditIds: string[], companyId: string) {
  const wp = new WPClient();
  const fixed: string[] = [];
  const errors: string[] = [];

  for (const id of auditIds) {
    const { data: record } = await sb.from("seo_link_audit").select("*").eq("id", id).single();
    if (!record || record.is_fixed) continue;

    try {
      if (record.status === "opportunity" && record.suggested_href) {
        // Find the WP page/post and inject the RSIC link
        const wpItem = await findWPItem(wp, record.page_url);
        if (wpItem) {
          const newLink = `<a href="${record.suggested_href}" target="_blank" rel="noopener noreferrer">${record.suggested_anchor}</a>`;
          const content = wpItem.content.rendered;

          // Find the first paragraph that contains a matching keyword
          const resource = RSIC_RESOURCES.find((r) => r.href === record.suggested_href);
          let updatedContent = content;

          if (resource) {
            const textLower = content.toLowerCase();
            for (const kw of resource.keywords) {
              const idx = textLower.indexOf(kw);
              if (idx !== -1) {
                // Find the end of the sentence/paragraph containing this keyword
                const periodIdx = content.indexOf(".", idx);
                if (periodIdx !== -1) {
                  updatedContent = content.slice(0, periodIdx + 1) + " " + newLink + content.slice(periodIdx + 1);
                  break;
                }
              }
            }
          }

          if (updatedContent !== content) {
            await updateWPContent(wp, wpItem, updatedContent);
            await logChange(sb, companyId, wpItem, "rsic_link_added", record.suggested_href);
          }
        }
      }

      await sb.from("seo_link_audit").update({ is_fixed: true }).eq("id", id);
      fixed.push(id);
    } catch (e) {
      console.error(`Fix error for ${id}:`, e);
      errors.push(id);
    }
  }

  return new Response(JSON.stringify({ success: true, fixed: fixed.length, errors: errors.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── HELPERS ───

function extractLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const regex = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.push({
      href: match[1],
      text: match[2].replace(/<[^>]+>/g, "").trim(),
    });
  }
  return links;
}

async function fetchAllWP(wp: WPClient, type: "pages" | "posts"): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    try {
      const items = type === "pages"
        ? await wp.listPages({ per_page: "50", page: String(page) })
        : await wp.listPosts({ per_page: "50", page: String(page) });
      if (!items || items.length === 0) break;
      all.push(...items);
      if (items.length < 50) break;
      page++;
    } catch {
      break;
    }
  }
  return all;
}

async function fetchAllWPProducts(wp: WPClient): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    try {
      const items = await wp.listProducts({ per_page: "50", page: String(page) });
      if (!items || items.length === 0) break;
      // Products use description instead of content
      all.push(...items.map((p: any) => ({ ...p, content: { rendered: p.description || "" } })));
      if (items.length < 50) break;
      page++;
    } catch {
      break;
    }
  }
  return all;
}

async function findWPItem(wp: WPClient, pageUrl: string): Promise<any | null> {
  // Try to find by slug
  const url = new URL(pageUrl);
  const slug = url.pathname.replace(/^\/|\/$/g, "").split("/").pop() || "";
  if (!slug) return null;

  try {
    const pages = await wp.listPages({ slug, per_page: "1" });
    if (pages && pages.length > 0) return { ...pages[0], type: "page" };
  } catch { /* ignore */ }

  try {
    const posts = await wp.listPosts({ slug, per_page: "1" });
    if (posts && posts.length > 0) return { ...posts[0], type: "post" };
  } catch { /* ignore */ }

  return null;
}

async function updateWPContent(wp: WPClient, item: any, content: string) {
  if (item.type === "page") {
    await wp.updatePage(String(item.id), { content });
  } else {
    await wp.updatePost(String(item.id), { content });
  }
}

async function logChange(sb: any, companyId: string, item: any, changeType: string, detail: string) {
  await sb.from("wp_change_log").insert({
    company_id: companyId,
    entity_type: item.type || "page",
    entity_id: String(item.id),
    change_type: changeType,
    change_summary: `Added RSIC link: ${detail}`,
    changed_by: "seo-link-audit",
  }).then(({ error }: any) => {
    if (error) console.error("Log error:", error.message);
  });
}
