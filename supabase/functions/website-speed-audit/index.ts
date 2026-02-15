import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SpeedIssue {
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  metric?: number;
  threshold?: number;
  assigned_agent: string;
}

interface Recommendation {
  action: string;
  priority: number;
  title: string;
  description: string;
  requires_server_access: boolean;
}

async function measureTTFB(url: string): Promise<{ ttfb_ms: number; status: number; content_length: number; html?: string }> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RebarShop-SpeedAudit/1.0" },
      redirect: "follow",
    });
    const ttfb_ms = Math.round(performance.now() - start);
    const html = await res.text();
    return { ttfb_ms, status: res.status, content_length: html.length, html };
  } catch (e) {
    return { ttfb_ms: Math.round(performance.now() - start), status: 0, content_length: 0 };
  }
}

function analyzeHTML(html: string): {
  totalSizeKB: number;
  inlineStyleKB: number;
  inlineScriptKB: number;
  imgCount: number;
  imgsWithoutLazy: number;
  imgsWithoutDimensions: number;
  renderBlockingResources: number;
  externalScripts: number;
  externalStyles: number;
} {
  const totalSizeKB = Math.round(html.length / 1024);

  // Inline styles
  const inlineStyles = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const inlineStyleKB = Math.round(inlineStyles.join("").length / 1024);

  // Inline scripts
  const inlineScripts = html.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || [];
  const inlineScriptKB = Math.round(inlineScripts.join("").length / 1024);

  // Images
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imgCount = imgTags.length;
  const imgsWithoutLazy = imgTags.filter(tag => !tag.includes('loading="lazy"') && !tag.includes("loading='lazy'")).length;
  const imgsWithoutDimensions = imgTags.filter(tag => !tag.includes("width=") || !tag.includes("height=")).length;

  // Render-blocking resources (scripts without async/defer in <head>)
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  let renderBlockingResources = 0;
  if (headMatch) {
    const headScripts = headMatch[0].match(/<script[^>]*src[^>]*>/gi) || [];
    renderBlockingResources = headScripts.filter(tag => !tag.includes("async") && !tag.includes("defer")).length;
    const headStyles = headMatch[0].match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || [];
    renderBlockingResources += headStyles.filter(tag => !tag.includes("media=")).length;
  }

  // External resources
  const externalScripts = (html.match(/<script[^>]*src[^>]*>/gi) || []).length;
  const externalStyles = (html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []).length;

  return { totalSizeKB, inlineStyleKB, inlineScriptKB, imgCount, imgsWithoutLazy, imgsWithoutDimensions, renderBlockingResources, externalScripts, externalStyles };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = Deno.env.get("WP_BASE_URL")?.replace(/\/wp-json\/wp\/v2\/?$/, "") || "https://rebar.shop";
    const issues: SpeedIssue[] = [];
    const recommendations: Recommendation[] = [];
    const now = new Date();

    // Pages to audit
    const pages = [
      { name: "homepage", url: baseUrl },
      { name: "shop", url: `${baseUrl}/shop/` },
      { name: "blog", url: `${baseUrl}/blog/` },
    ];

    const ttfbResults: Record<string, number> = {};
    const pageWeights: Record<string, number> = {};

    // Measure TTFB and analyze HTML for each page
    for (const page of pages) {
      console.log(`⏱️ Measuring ${page.name}: ${page.url}`);
      const result = await measureTTFB(page.url);
      ttfbResults[page.name] = result.ttfb_ms;
      pageWeights[`${page.name}_html_kb`] = Math.round(result.content_length / 1024);

      // TTFB checks
      if (result.ttfb_ms > 2500) {
        issues.push({
          type: "slow_ttfb",
          severity: "critical",
          title: `Critical TTFB: ${page.name} takes ${(result.ttfb_ms / 1000).toFixed(1)}s`,
          description: `Time to First Byte for ${page.name} is ${result.ttfb_ms}ms — target is under 800ms. This is the #1 bottleneck.`,
          metric: result.ttfb_ms,
          threshold: 800,
          assigned_agent: "webbuilder",
        });
      } else if (result.ttfb_ms > 1500) {
        issues.push({
          type: "slow_ttfb",
          severity: "warning",
          title: `Slow TTFB: ${page.name} takes ${(result.ttfb_ms / 1000).toFixed(1)}s`,
          description: `Time to First Byte for ${page.name} is ${result.ttfb_ms}ms — should be under 800ms.`,
          metric: result.ttfb_ms,
          threshold: 800,
          assigned_agent: "webbuilder",
        });
      }

      // HTML analysis
      if (result.html) {
        const analysis = analyzeHTML(result.html);

        if (analysis.totalSizeKB > 200) {
          issues.push({
            type: "heavy_page",
            severity: "warning",
            title: `Heavy page: ${page.name} is ${analysis.totalSizeKB}KB HTML`,
            description: `Page HTML alone is ${analysis.totalSizeKB}KB. Target is under 200KB. Large pages slow rendering.`,
            metric: analysis.totalSizeKB,
            threshold: 200,
            assigned_agent: "copywriting",
          });
        }

        if (analysis.inlineStyleKB > 50) {
          issues.push({
            type: "inline_css_bloat",
            severity: "warning",
            title: `Inline CSS bloat: ${page.name} has ${analysis.inlineStyleKB}KB inline styles`,
            description: `${analysis.inlineStyleKB}KB of inline CSS detected. Should be externalized and cached.`,
            metric: analysis.inlineStyleKB,
            assigned_agent: "webbuilder",
          });
        }

        if (analysis.inlineScriptKB > 30) {
          issues.push({
            type: "inline_js_bloat",
            severity: "warning",
            title: `Inline JS bloat: ${page.name} has ${analysis.inlineScriptKB}KB inline scripts`,
            description: `${analysis.inlineScriptKB}KB of inline JavaScript. Should be deferred or externalized.`,
            metric: analysis.inlineScriptKB,
            assigned_agent: "webbuilder",
          });
        }

        if (analysis.imgsWithoutLazy > 3) {
          issues.push({
            type: "missing_lazy_loading",
            severity: "warning",
            title: `${analysis.imgsWithoutLazy} images without lazy loading on ${page.name}`,
            description: `${analysis.imgsWithoutLazy} of ${analysis.imgCount} images are missing loading="lazy". This forces all images to load upfront.`,
            metric: analysis.imgsWithoutLazy,
            assigned_agent: "webbuilder",
          });
        }

        if (analysis.imgsWithoutDimensions > 3) {
          issues.push({
            type: "missing_image_dimensions",
            severity: "info",
            title: `${analysis.imgsWithoutDimensions} images missing dimensions on ${page.name}`,
            description: `Images without width/height cause layout shifts (CLS). ${analysis.imgsWithoutDimensions} images affected.`,
            metric: analysis.imgsWithoutDimensions,
            assigned_agent: "webbuilder",
          });
        }

        if (analysis.renderBlockingResources > 3) {
          issues.push({
            type: "render_blocking",
            severity: "warning",
            title: `${analysis.renderBlockingResources} render-blocking resources on ${page.name}`,
            description: `${analysis.renderBlockingResources} scripts/stylesheets block page rendering. Use async/defer for scripts and media queries for stylesheets.`,
            metric: analysis.renderBlockingResources,
            assigned_agent: "webbuilder",
          });
        }
      }
    }

    // Generate recommendations based on findings
    const avgTTFB = Object.values(ttfbResults).reduce((s, v) => s + v, 0) / Object.values(ttfbResults).length;

    // Hardcoded Site Health items (from WP Site Health report)
    recommendations.push({
      action: "fix_autoloaded_options",
      priority: 0,
      title: "Clean autoloaded options bloat (1.1 MB)",
      description: "Autoloaded data is 1.1 MB. Install Advanced Database Cleaner or WP-Optimize to purge stale transients and expired options. Target: under 800 KB.",
      requires_server_access: true,
    });
    recommendations.push({
      action: "enable_object_cache",
      priority: 1,
      title: "Enable persistent object cache (Redis/Memcached)",
      description: "No Redis/Memcached detected. Enable persistent object caching via your hosting panel (most managed hosts offer one-click Redis). This eliminates redundant database queries on every page load.",
      requires_server_access: true,
    });
    recommendations.push({
      action: "fix_consent_api",
      priority: 2,
      title: "Fix Consent API non-compliance",
      description: "One or more plugins don't declare cookie consent via the WP Consent API. Update CookieYes/cookie plugins or replace with a Consent API-compatible alternative.",
      requires_server_access: true,
    });

    if (avgTTFB > 2000) {
      recommendations.push({
        action: "install_cache_plugin",
        priority: 1,
        title: "Install a caching plugin (WP Super Cache or LiteSpeed Cache)",
        description: `Average TTFB is ${Math.round(avgTTFB)}ms. A page caching plugin can reduce this by 60-80%. This is the single most impactful fix.`,
        requires_server_access: true,
      });
      recommendations.push({
        action: "enable_cdn",
        priority: 2,
        title: "Set up Cloudflare CDN",
        description: "CDN caches static assets (images, CSS, JS) at edge locations globally, reducing load times for all visitors.",
        requires_server_access: true,
      });
      recommendations.push({
        action: "upgrade_php",
        priority: 3,
        title: "Upgrade to PHP 8.2+ and enable OPcache",
        description: "PHP 8.2 is 15-20% faster than PHP 7.x. OPcache eliminates repeated PHP compilation.",
        requires_server_access: true,
      });
    }

    if (avgTTFB > 1500) {
      recommendations.push({
        action: "clean_database",
        priority: 4,
        title: "Clean database bloat (revisions, transients, spam)",
        description: "Install WP-Optimize or similar to clean post revisions, expired transients, and spam comments that slow database queries.",
        requires_server_access: true,
      });
    }

    recommendations.push({
      action: "image_optimization",
      priority: 5,
      title: "Install ShortPixel or Imagify for automatic WebP conversion",
      description: "Automatic image compression and WebP conversion can reduce image payload by 50-80%.",
      requires_server_access: true,
    });

    recommendations.push({
      action: "minify_assets",
      priority: 6,
      title: "Install Autoptimize to minify and defer CSS/JS",
      description: "Minifying CSS/JS and deferring non-critical resources improves First Contentful Paint.",
      requires_server_access: true,
    });

    console.log(`🚀 Speed audit complete: ${issues.length} issues, ${recommendations.length} recommendations`);

    return new Response(
      JSON.stringify({
        ok: true,
        audited_at: now.toISOString(),
        ttfb: ttfbResults,
        page_weight: pageWeights,
        avg_ttfb_ms: Math.round(avgTTFB),
        issues_found: issues.length,
        issues,
        recommendations_count: recommendations.length,
        recommendations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Speed audit error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
