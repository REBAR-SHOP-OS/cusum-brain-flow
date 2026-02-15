import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PageResult {
  url: string;
  status_code: number;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  canonical: string | null;
  robots_directives: string | null;
  in_sitemap: boolean;
  redirect_target: string | null;
  word_count: number;
  load_time_ms: number;
  issues: { type: string; severity: string; title: string; description: string }[];
}

async function fetchSitemapUrls(domain: string): Promise<Set<string>> {
  const urls = new Set<string>();
  try {
    const res = await fetch(`https://${domain}/sitemap.xml`, { redirect: "follow" });
    if (!res.ok) return urls;
    const xml = await res.text();
    // Simple regex extraction
    const matches = xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
    for (const m of matches) {
      const loc = m[1].trim();
      if (loc.endsWith(".xml")) {
        // Nested sitemap
        try {
          const subRes = await fetch(loc, { redirect: "follow" });
          if (subRes.ok) {
            const subXml = await subRes.text();
            const subMatches = subXml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
            for (const sm of subMatches) urls.add(sm[1].trim());
          }
        } catch { /* skip */ }
      } else {
        urls.add(loc);
      }
    }
  } catch (e) {
    console.error("Sitemap fetch failed:", e);
  }
  return urls;
}

async function crawlPage(url: string): Promise<PageResult> {
  const issues: PageResult["issues"] = [];
  const start = Date.now();
  let status_code = 0;
  let title: string | null = null;
  let meta_description: string | null = null;
  let h1: string | null = null;
  let canonical: string | null = null;
  let robots_directives: string | null = null;
  let redirect_target: string | null = null;
  let word_count = 0;

  try {
    const res = await fetch(url, { redirect: "manual" });
    status_code = res.status;

    if (status_code >= 300 && status_code < 400) {
      redirect_target = res.headers.get("location");
      return {
        url, status_code, title, meta_description, h1, canonical,
        robots_directives, in_sitemap: false, redirect_target, word_count,
        load_time_ms: Date.now() - start, issues,
      };
    }

    if (status_code >= 400) {
      issues.push({
        type: "broken_link",
        severity: "critical",
        title: `Broken page (${status_code})`,
        description: `${url} returns HTTP ${status_code}`,
      });
      return {
        url, status_code, title, meta_description, h1, canonical,
        robots_directives, in_sitemap: false, redirect_target, word_count,
        load_time_ms: Date.now() - start, issues,
      };
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) throw new Error("Failed to parse HTML");

    // Title
    const titleEl = doc.querySelector("title");
    title = titleEl?.textContent?.trim() || null;
    if (!title) {
      issues.push({ type: "missing_meta", severity: "warning", title: "Missing title tag", description: `${url} has no <title>` });
    }

    // Meta description
    const metaDesc = doc.querySelector('meta[name="description"]');
    meta_description = metaDesc?.getAttribute("content")?.trim() || null;
    if (!meta_description) {
      issues.push({ type: "missing_meta", severity: "warning", title: "Missing meta description", description: `${url} has no meta description` });
    }

    // H1
    const h1El = doc.querySelector("h1");
    h1 = h1El?.textContent?.trim() || null;
    if (!h1) {
      issues.push({ type: "missing_h1", severity: "warning", title: "Missing H1", description: `${url} has no H1 heading` });
    }

    // Canonical
    const canonicalEl = doc.querySelector('link[rel="canonical"]');
    canonical = canonicalEl?.getAttribute("href")?.trim() || null;
    if (!canonical) {
      issues.push({ type: "missing_canonical", severity: "info", title: "Missing canonical", description: `${url} has no canonical tag` });
    }

    // Robots meta
    const robotsMeta = doc.querySelector('meta[name="robots"]');
    robots_directives = robotsMeta?.getAttribute("content")?.trim() || null;
    if (robots_directives?.includes("noindex")) {
      issues.push({ type: "noindex_conflict", severity: "warning", title: "Page set to noindex", description: `${url} has noindex directive` });
    }

    // Word count (body text)
    const bodyText = doc.querySelector("body")?.textContent || "";
    word_count = bodyText.split(/\s+/).filter(Boolean).length;
    if (word_count < 100) {
      issues.push({ type: "thin_content", severity: "info", title: "Thin content", description: `${url} has only ${word_count} words` });
    }
  } catch (e) {
    console.error(`Error crawling ${url}:`, e);
    issues.push({
      type: "broken_link",
      severity: "critical",
      title: "Fetch failed",
      description: `Could not fetch ${url}: ${e instanceof Error ? e.message : "unknown error"}`,
    });
  }

  return {
    url, status_code, title, meta_description, h1, canonical,
    robots_directives, in_sitemap: false, redirect_target, word_count,
    load_time_ms: Date.now() - start, issues,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { domain_id, max_pages = 100 } = await req.json();
    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: domain } = await supabase
      .from("seo_domains")
      .select("*")
      .eq("id", domain_id)
      .single();
    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create crawl run
    const { data: crawlRun } = await supabase
      .from("seo_crawl_runs")
      .insert({ domain_id, status: "running", company_id: domain.company_id })
      .select("id")
      .single();
    if (!crawlRun) throw new Error("Failed to create crawl run");

    // Get sitemap URLs
    const sitemapUrls = await fetchSitemapUrls(domain.domain);
    console.log(`Found ${sitemapUrls.size} URLs in sitemap`);

    // Start with sitemap URLs, add homepage if not present
    const urlsToVisit = new Set(sitemapUrls);
    urlsToVisit.add(`https://${domain.domain}/`);

    const allPages: PageResult[] = [];
    const visited = new Set<string>();
    let titleMap = new Map<string, string[]>();
    let descMap = new Map<string, string[]>();

    for (const url of urlsToVisit) {
      if (visited.size >= max_pages) break;
      if (visited.has(url)) continue;
      visited.add(url);

      const result = await crawlPage(url);
      result.in_sitemap = sitemapUrls.has(url);
      allPages.push(result);

      // Track duplicates
      if (result.title) {
        const existing = titleMap.get(result.title) || [];
        existing.push(url);
        titleMap.set(result.title, existing);
      }
      if (result.meta_description) {
        const existing = descMap.get(result.meta_description) || [];
        existing.push(url);
        descMap.set(result.meta_description, existing);
      }
    }

    // Detect duplicates
    const allIssues: { page_url: string; type: string; severity: string; title: string; description: string }[] = [];

    for (const [title, urls] of titleMap) {
      if (urls.length > 1) {
        for (const u of urls) {
          allIssues.push({
            page_url: u,
            type: "duplicate_title",
            severity: "warning",
            title: "Duplicate title",
            description: `Title "${title.substring(0, 60)}" shared by ${urls.length} pages`,
          });
        }
      }
    }
    for (const [desc, urls] of descMap) {
      if (urls.length > 1) {
        for (const u of urls) {
          allIssues.push({
            page_url: u,
            type: "duplicate_description",
            severity: "warning",
            title: "Duplicate meta description",
            description: `Description shared by ${urls.length} pages`,
          });
        }
      }
    }

    // Insert pages
    for (const page of allPages) {
      const { data: pageRow } = await supabase
        .from("seo_crawl_pages")
        .insert({
          crawl_run_id: crawlRun.id,
          url: page.url,
          status_code: page.status_code,
          title: page.title,
          meta_description: page.meta_description,
          h1: page.h1,
          canonical: page.canonical,
          robots_directives: page.robots_directives,
          in_sitemap: page.in_sitemap,
          redirect_target: page.redirect_target,
          word_count: page.word_count,
          load_time_ms: page.load_time_ms,
          issues_json: page.issues,
          company_id: domain.company_id,
        })
        .select("id")
        .single();

      // Insert page-level issues
      if (pageRow) {
        for (const issue of page.issues) {
          await supabase.from("seo_issues").insert({
            crawl_run_id: crawlRun.id,
            page_id: pageRow.id,
            severity: issue.severity,
            issue_type: issue.type,
            title: issue.title,
            description: issue.description,
            page_url: page.url,
            company_id: domain.company_id,
          });
        }
      }
    }

    // Insert cross-page issues (duplicates)
    for (const issue of allIssues) {
      await supabase.from("seo_issues").insert({
        crawl_run_id: crawlRun.id,
        severity: issue.severity,
        issue_type: issue.type,
        title: issue.title,
        description: issue.description,
        page_url: issue.page_url,
        company_id: domain.company_id,
      });
    }

    // Calculate health score
    const totalIssues = allPages.reduce((sum, p) => sum + p.issues.length, 0) + allIssues.length;
    const criticalCount = allPages.reduce((sum, p) => sum + p.issues.filter(i => i.severity === "critical").length, 0);
    const warningCount = totalIssues - criticalCount;
    const maxScore = allPages.length * 5; // 5 checks per page
    const deductions = criticalCount * 10 + warningCount * 3;
    const healthScore = Math.max(0, Math.round(((maxScore - deductions) / Math.max(maxScore, 1)) * 100));

    await supabase.from("seo_crawl_runs").update({
      status: "completed",
      pages_crawled: allPages.length,
      health_score: healthScore,
      issues_critical: criticalCount,
      issues_warning: warningCount,
      issues_info: totalIssues - criticalCount - warningCount,
      completed_at: new Date().toISOString(),
    }).eq("id", crawlRun.id);

    return new Response(
      JSON.stringify({
        success: true,
        crawl_run_id: crawlRun.id,
        pages_crawled: allPages.length,
        health_score: healthScore,
        issues: { critical: criticalCount, warning: warningCount, total: totalIssues },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-site-crawl error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
