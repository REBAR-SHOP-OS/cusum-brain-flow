import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { WPClient } from "../_shared/wpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthIssue {
  issue_type: string;
  severity: "critical" | "warning" | "info";
  assigned_agent: string;
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  impact: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const wp = new WPClient();
    const issues: HealthIssue[] = [];
    const now = new Date();

    // 1. Fetch posts (published + drafts)
    const [publishedPosts, draftPosts, pages, products] = await Promise.all([
      wp.listPosts({ per_page: "100", status: "publish" }).catch(() => []),
      wp.listPosts({ per_page: "100", status: "draft" }).catch(() => []),
      wp.listPages({ per_page: "100" }).catch(() => []),
      wp.listProducts({ per_page: "100" }).catch(() => []),
    ]);

    const allPosts = [...(Array.isArray(publishedPosts) ? publishedPosts : []), ...(Array.isArray(draftPosts) ? draftPosts : [])];
    const allPages = Array.isArray(pages) ? pages : [];
    const allProducts = Array.isArray(products) ? products : [];

    // 2. Check for missing meta descriptions (excerpt) on posts
    for (const post of allPosts) {
      const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, "").trim() || "";
      if (!excerpt && post.status === "publish") {
        issues.push({
          issue_type: "missing_meta",
          severity: "warning",
          assigned_agent: "seo",
          title: `Post "${post.title?.rendered || post.slug}" missing meta description`,
          description: `Published post has no excerpt/meta description set, hurting SEO.`,
          entity_type: "wp_post",
          entity_id: String(post.id),
          reason: "Posts without meta descriptions get poor click-through rates in search results.",
          impact: "Reduced organic traffic",
        });
      }
    }

    // 3. Check for missing meta descriptions on pages
    for (const page of allPages) {
      const excerpt = page.excerpt?.rendered?.replace(/<[^>]+>/g, "").trim() || "";
      if (!excerpt && page.status === "publish") {
        issues.push({
          issue_type: "missing_meta",
          severity: "warning",
          assigned_agent: "seo",
          title: `Page "${page.title?.rendered || page.slug}" missing meta description`,
          description: `Published page has no excerpt/meta description set.`,
          entity_type: "wp_page",
          entity_id: String(page.id),
          reason: "Pages without meta descriptions perform poorly in search results.",
          impact: "Reduced organic traffic",
        });
      }
    }

    // 4. Check for stale drafts (30+ days old)
    for (const post of allPosts) {
      if (post.status !== "draft") continue;
      const modified = new Date(post.modified || post.date);
      const daysSinceModified = Math.floor((now.getTime() - modified.getTime()) / 86400000);
      if (daysSinceModified > 30) {
        issues.push({
          issue_type: "stale_draft",
          severity: "info",
          assigned_agent: "copywriting",
          title: `Stale draft: "${post.title?.rendered || post.slug}" (${daysSinceModified}d old)`,
          description: `This draft hasn't been modified in ${daysSinceModified} days. Consider publishing, updating, or deleting it.`,
          entity_type: "wp_post",
          entity_id: String(post.id),
          reason: "Stale drafts clutter the content pipeline and may contain outdated information.",
          impact: "Content pipeline hygiene",
        });
      }
    }

    // 5. Check for duplicate slugs (-2 suffix)
    for (const post of allPosts) {
      if (post.slug?.match(/-\d+$/)) {
        issues.push({
          issue_type: "duplicate_slug",
          severity: "critical",
          assigned_agent: "seo",
          title: `Duplicate slug detected: "${post.slug}"`,
          description: `Post "${post.title?.rendered}" has a slug ending in a number suffix, indicating a duplicate.`,
          entity_type: "wp_post",
          entity_id: String(post.id),
          reason: "Duplicate slugs cause URL conflicts, dilute SEO authority, and confuse search engines.",
          impact: "SEO authority dilution",
        });
      }
    }
    for (const page of allPages) {
      if (page.slug?.match(/-\d+$/)) {
        issues.push({
          issue_type: "duplicate_slug",
          severity: "critical",
          assigned_agent: "seo",
          title: `Duplicate page slug: "${page.slug}"`,
          description: `Page "${page.title?.rendered}" has a duplicate slug suffix.`,
          entity_type: "wp_page",
          entity_id: String(page.id),
          reason: "Duplicate slugs dilute SEO authority and create confusing URLs.",
          impact: "SEO authority dilution",
        });
      }
    }

    // 6. Check for blog silence (no new post in 30+ days)
    const publishedOnly = allPosts.filter((p: any) => p.status === "publish");
    if (publishedOnly.length > 0) {
      const latestDate = new Date(Math.max(...publishedOnly.map((p: any) => new Date(p.date).getTime())));
      const daysSinceLastPost = Math.floor((now.getTime() - latestDate.getTime()) / 86400000);
      if (daysSinceLastPost > 30) {
        issues.push({
          issue_type: "blog_silence",
          severity: "warning",
          assigned_agent: "copywriting",
          title: `No new blog post in ${daysSinceLastPost} days`,
          description: `The last blog post was published ${daysSinceLastPost} days ago. Regular content helps SEO and engagement.`,
          entity_type: "wp_post",
          entity_id: "blog_silence",
          reason: "Search engines favor sites that publish fresh content regularly.",
          impact: "Declining organic rankings",
        });
      }
    }

    // 7. Check for products with missing images or short descriptions
    for (const product of allProducts) {
      if (product.error) continue; // WooCommerce not available
      const images = product.images || [];
      const shortDesc = product.short_description?.replace(/<[^>]+>/g, "").trim() || "";
      
      if (images.length === 0) {
        issues.push({
          issue_type: "product_no_image",
          severity: "warning",
          assigned_agent: "webbuilder",
          title: `Product "${product.name}" has no images`,
          description: `This product has no images, which hurts conversions.`,
          entity_type: "wp_product",
          entity_id: String(product.id),
          reason: "Products without images have significantly lower conversion rates.",
          impact: "Lost sales",
        });
      }

      if (shortDesc.length < 20) {
        issues.push({
          issue_type: "product_weak_description",
          severity: "info",
          assigned_agent: "copywriting",
          title: `Product "${product.name}" has weak description`,
          description: `Short description is only ${shortDesc.length} chars. Recommend at least 50+ chars.`,
          entity_type: "wp_product",
          entity_id: String(product.id),
          reason: "Short product descriptions reduce buyer confidence and SEO value.",
          impact: "Lower conversions",
        });
      }
    }

    // 8. Performance: Measure TTFB for homepage
    const baseUrl = Deno.env.get("WP_BASE_URL")?.replace(/\/wp-json\/wp\/v2\/?$/, "") || "https://rebar.shop";
    try {
      const ttfbStart = performance.now();
      const homeRes = await fetch(baseUrl, {
        headers: { "User-Agent": "RebarShop-HealthCheck/1.0" },
        redirect: "follow",
      });
      const ttfb = Math.round(performance.now() - ttfbStart);
      const homeHtml = await homeRes.text();
      const homeSizeKB = Math.round(homeHtml.length / 1024);

      if (ttfb > 2500) {
        issues.push({
          issue_type: "slow_ttfb",
          severity: "critical",
          assigned_agent: "webbuilder",
          title: `Critical TTFB: homepage takes ${(ttfb / 1000).toFixed(1)}s`,
          description: `Time to First Byte is ${ttfb}ms — target is under 800ms. Install a caching plugin.`,
          entity_type: "wp_speed",
          entity_id: "homepage_ttfb",
          reason: "TTFB accounts for 80% of page load time. Without caching, every visitor waits 3+ seconds.",
          impact: "Failed Core Web Vitals",
        });
      } else if (ttfb > 1500) {
        issues.push({
          issue_type: "slow_ttfb",
          severity: "warning",
          assigned_agent: "webbuilder",
          title: `Slow TTFB: homepage takes ${(ttfb / 1000).toFixed(1)}s`,
          description: `TTFB is ${ttfb}ms — should be under 800ms.`,
          entity_type: "wp_speed",
          entity_id: "homepage_ttfb",
          reason: "Slow server response hurts all Core Web Vitals metrics.",
          impact: "Poor PageSpeed score",
        });
      }

      if (homeSizeKB > 200) {
        issues.push({
          issue_type: "heavy_page",
          severity: "warning",
          assigned_agent: "copywriting",
          title: `Homepage HTML is ${homeSizeKB}KB`,
          description: `Page HTML is ${homeSizeKB}KB — target is under 200KB. Trim unnecessary markup or page builder bloat.`,
          entity_type: "wp_speed",
          entity_id: "homepage_weight",
          reason: "Large HTML payloads increase download time and parsing delay.",
          impact: "Slower FCP and LCP",
        });
      }

      // Check for images missing lazy loading
      const imgTags = homeHtml.match(/<img[^>]*>/gi) || [];
      const imgsWithoutLazy = imgTags.filter((t: string) => !t.includes('loading="lazy"') && !t.includes("loading='lazy'")).length;
      if (imgsWithoutLazy > 5) {
        issues.push({
          issue_type: "missing_lazy_load",
          severity: "warning",
          assigned_agent: "webbuilder",
          title: `${imgsWithoutLazy} images without lazy loading on homepage`,
          description: `${imgsWithoutLazy} of ${imgTags.length} images load eagerly, slowing initial page render.`,
          entity_type: "wp_speed",
          entity_id: "homepage_lazy",
          reason: "Without lazy loading, all images download immediately even if below the fold.",
          impact: "Slower LCP and higher bandwidth",
        });
      }
    } catch (perfErr) {
      console.error("Performance check failed (non-fatal):", perfErr);
    }

    console.log(`🏥 Website health check: ${issues.length} issues found`);

    return new Response(
      JSON.stringify({
        ok: true,
        checked_at: now.toISOString(),
        posts_checked: allPosts.length,
        pages_checked: allPages.length,
        products_checked: allProducts.length,
        issues_found: issues.length,
        issues,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Website health check error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
