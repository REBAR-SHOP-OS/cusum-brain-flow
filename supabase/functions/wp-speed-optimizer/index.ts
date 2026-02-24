import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OptimizationResult {
  type: string;
  id: number;
  title: string;
  changes: string[];
  images_fixed: number;
}

interface MediaAuditItem {
  id: number;
  title: string;
  source_url: string;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  issues: string[];
}

// Radin's profile ID for task assignment
const RADIN_PROFILE_ID = "5d948a66-619b-4ee1-b5e3-063194db7171";
const COMPANY_ID = "a0000000-0000-0000-0000-000000000001";

// Server-side tasks to create for radin after optimization
const SERVER_TASKS = [
  { title: "Install Caching Plugin (LiteSpeed/WP Super Cache) on rebar.shop", description: "Air Lift was removed. Install LiteSpeed Cache or WP Super Cache to restore page caching, browser caching, and GZIP compression. This is the #1 priority fix for site speed.", priority: "high" },
  { title: "Enable Redis Object Cache on rebar.shop", description: "No Redis/Memcached detected. Enable persistent object caching via hosting panel to eliminate redundant DB queries on every page load.", priority: "high" },
  { title: "Clean Autoloaded Options Bloat (1.1MB) on rebar.shop", description: "Autoloaded data is 1.1 MB. Use Advanced Database Cleaner or WP-Optimize to purge stale transients and expired options. Target: under 800 KB.", priority: "high" },
  { title: "Clean Air Lift Leftovers from Database on rebar.shop", description: "Check database for orphaned Air Lift tables using Advanced Database Cleaner. Remove any leftover files in wp-content/plugins/ and wp-content/cache/.", priority: "medium" },
  { title: "Install Image Compression Plugin (ShortPixel/Imagify) on rebar.shop", description: "Media library has oversized images that need server-side compression. Install ShortPixel or Imagify plugin to auto-compress uploads.", priority: "medium" },
  { title: "Fix Consent API Non-Compliance on rebar.shop", description: "One or more plugins don't declare cookie consent via the WP Consent API. Update CookieYes/cookie plugins or replace with a Consent API-compatible alternative.", priority: "low" },
];

// Fetch image dimensions via partial download
async function getImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const imgRes = await fetch(url, { headers: { Range: "bytes=0-65535" } });
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    return detectDimensionsFromBytes(buf);
  } catch {
    return null;
  }
}

function detectDimensionsFromBytes(buf: Uint8Array): { width: number; height: number } | null {
  // JPEG: look for SOF0/SOF2 markers
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] === 0xFF) {
        const marker = buf[i + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const height = (buf[i + 5] << 8) | buf[i + 6];
          const width = (buf[i + 7] << 8) | buf[i + 8];
          if (width > 0 && height > 0) return { width, height };
        }
        const len = (buf[i + 2] << 8) | buf[i + 3];
        i += 2 + len;
      } else {
        i++;
      }
    }
  }
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    const width = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
    const height = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
    if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
  }
  // WebP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38) {
      if (buf[15] === 0x20 && buf.length > 29) {
        const width = ((buf[26] | (buf[27] << 8)) & 0x3FFF);
        const height = ((buf[28] | (buf[29] << 8)) & 0x3FFF);
        if (width > 0 && height > 0) return { width, height };
      }
    }
  }
  return null;
}

// Extract src from an img tag
function extractSrc(attrs: string): string | null {
  const m = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function optimizeImgTags(html: string, isFirstContent: boolean): Promise<{ html: string; changes: string[]; imagesFixed: number }> {
  const changes: string[] = [];
  let imagesFixed = 0;
  let imgIndex = 0;

  const imgMatches: Array<{ match: string; attrs: string; index: number }> = [];
  const imgRegex = /<img([^>]*)>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    imgMatches.push({ match: m[0], attrs: m[1], index: m.index });
  }

  const replacements: Array<{ original: string; replacement: string }> = [];

  for (const img of imgMatches) {
    imgIndex++;
    let newAttrs = img.attrs;
    let modified = false;
    const isAboveFold = isFirstContent && imgIndex === 1;

    if (isAboveFold && !/fetchpriority\s*=/i.test(newAttrs)) {
      newAttrs += ' fetchpriority="high"';
      changes.push(`Image #${imgIndex}: added fetchpriority="high"`);
      modified = true;
    }

    if (!isAboveFold && !/loading\s*=/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
      changes.push(`Image #${imgIndex}: added loading="lazy"`);
      modified = true;
    }

    if (!/decoding\s*=/i.test(newAttrs)) {
      newAttrs += ' decoding="async"';
      changes.push(`Image #${imgIndex}: added decoding="async"`);
      modified = true;
    }

    const hasDims = /width\s*=/i.test(newAttrs) && /height\s*=/i.test(newAttrs);
    if (!hasDims) {
      const src = extractSrc(newAttrs);
      if (src) {
        try {
          const dims = await getImageDimensions(src);
          if (dims) {
            if (!/width\s*=/i.test(newAttrs)) newAttrs += ` width="${dims.width}"`;
            if (!/height\s*=/i.test(newAttrs)) newAttrs += ` height="${dims.height}"`;
            changes.push(`Image #${imgIndex}: injected dimensions ${dims.width}×${dims.height}`);
            modified = true;
          }
        } catch { /* skip */ }
      }
    }

    if (modified) imagesFixed++;
    replacements.push({ original: img.match, replacement: `<img${newAttrs}>` });
  }

  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const idx = result.lastIndexOf(replacements[i].original);
    if (idx !== -1) {
      result = result.slice(0, idx) + replacements[i].replacement + result.slice(idx + replacements[i].original.length);
    }
  }

  return { html: result, changes, imagesFixed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false;
    const contentTypes = body.content_types || ["posts", "pages", "products"];
    const includeMediaAudit = body.media_audit !== false;

    // For live mode (not dry run), respond immediately and process in background
    if (!dryRun) {
      const jobId = crypto.randomUUID();
      
      // Start background processing (don't await)
      const bgPromise = runOptimization(supabase, contentTypes, includeMediaAudit, false, jobId);
      
      // Fire and forget - log errors but don't block
      bgPromise.catch((err) => {
        console.error("Background optimization error:", err);
      });

      return new Response(JSON.stringify({
        accepted: true,
        job_id: jobId,
        message: "Optimization started in background. Tasks will be created for server-side issues.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dry run: process synchronously
    const result = await runOptimization(supabase, contentTypes, includeMediaAudit, true, null);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Speed optimizer error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function runOptimization(
  supabase: any,
  contentTypes: string[],
  includeMediaAudit: boolean,
  dryRun: boolean,
  jobId: string | null,
) {
  const wpBaseUrl = Deno.env.get("WP_BASE_URL") || "https://rebar.shop/wp-json/wp/v2";
  const wpUser = Deno.env.get("WP_USERNAME") || "";
  const wpPass = Deno.env.get("WP_APP_PASSWORD") || "";
  const wcKey = Deno.env.get("WC_CONSUMER_KEY") || "";
  const wcSecret = Deno.env.get("WC_CONSUMER_SECRET") || "";
  const authHeader = "Basic " + btoa(`${wpUser}:${wpPass}`);

  const results: OptimizationResult[] = [];
  let totalImagesFixed = 0;
  let totalItemsScanned = 0;
  let totalItemsModified = 0;

  async function wpGet(endpoint: string): Promise<any[]> {
    const url = `${wpBaseUrl}${endpoint}`;
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (!res.ok) throw new Error(`WP API ${res.status}: ${url}`);
    return res.json();
  }

  async function wpUpdate(endpoint: string, data: any): Promise<any> {
    const url = `${wpBaseUrl}${endpoint}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`WP update ${res.status}: ${url}`);
    return res.json();
  }

  async function wcGet(endpoint: string): Promise<any[]> {
    const baseUrl = wpBaseUrl.replace(/\/wp-json\/wp\/v2\/?$/, "");
    const url = `${baseUrl}/wp-json/wc/v3${endpoint}?consumer_key=${wcKey}&consumer_secret=${wcSecret}&per_page=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WC API ${res.status}`);
    return res.json();
  }

  async function wcUpdate(endpoint: string, data: any): Promise<any> {
    const baseUrl = wpBaseUrl.replace(/\/wp-json\/wp\/v2\/?$/, "");
    const url = `${baseUrl}/wp-json/wc/v3${endpoint}?consumer_key=${wcKey}&consumer_secret=${wcSecret}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`WC update ${res.status}`);
    return res.json();
  }

  async function processContent(content: string, isFirst: boolean, entityLabel: string, entityId: number, entityType: string, updateFn: () => Promise<void>) {
    if (!content || !/<img/i.test(content)) return;
    const { html, changes, imagesFixed } = await optimizeImgTags(content, isFirst);
    if (changes.length === 0) return;
    totalItemsModified++;
    totalImagesFixed += imagesFixed;
    if (!dryRun) {
      await updateFn();
    }
    results.push({ type: entityType, id: entityId, title: entityLabel, changes, images_fixed: imagesFixed });
  }

  // Process posts
  if (contentTypes.includes("posts")) {
    try {
      const posts = await wpGet("/posts?per_page=100&status=publish");
      for (const post of posts) {
        totalItemsScanned++;
        const content = post.content?.rendered || post.content?.raw || "";
        await processContent(content, true, post.title?.rendered || `Post #${post.id}`, post.id, "post", async () => {
          const { html } = await optimizeImgTags(content, true);
          await wpUpdate(`/posts/${post.id}`, { content: html });
          await logWpChange(supabase, "speed-optimizer", `/posts/${post.id}`, "PUT", "post", String(post.id), { content }, { content: html });
        });
      }
    } catch (e) { console.error("Posts scan error:", e); }
  }

  // Process pages
  if (contentTypes.includes("pages")) {
    try {
      const pages = await wpGet("/pages?per_page=100&status=publish");
      for (const page of pages) {
        totalItemsScanned++;
        const content = page.content?.rendered || page.content?.raw || "";
        await processContent(content, true, page.title?.rendered || `Page #${page.id}`, page.id, "page", async () => {
          const { html } = await optimizeImgTags(content, true);
          await wpUpdate(`/pages/${page.id}`, { content: html });
          await logWpChange(supabase, "speed-optimizer", `/pages/${page.id}`, "PUT", "page", String(page.id), { content }, { content: html });
        });
      }
    } catch (e) { console.error("Pages scan error:", e); }
  }

  // Process WooCommerce products
  if (contentTypes.includes("products")) {
    try {
      const products = await wcGet("/products");
      for (const product of products) {
        totalItemsScanned++;
        const desc = product.description || "";
        let descHtml = desc;
        let descChanges: string[] = [];
        if (desc && /<img/i.test(desc)) {
          const r = await optimizeImgTags(desc, false);
          descHtml = r.html;
          descChanges = r.changes;
          totalImagesFixed += r.imagesFixed;
        }

        const shortDesc = product.short_description || "";
        let shortHtml = shortDesc;
        let shortChanges: string[] = [];
        if (shortDesc && /<img/i.test(shortDesc)) {
          const r = await optimizeImgTags(shortDesc, false);
          shortHtml = r.html;
          shortChanges = r.changes.map(c => `[short_desc] ${c}`);
          totalImagesFixed += r.imagesFixed;
        }

        const allChanges = [...descChanges, ...shortChanges];
        if (allChanges.length === 0) continue;

        totalItemsModified++;
        if (!dryRun) {
          const updateData: Record<string, string> = {};
          if (descChanges.length > 0) updateData.description = descHtml;
          if (shortChanges.length > 0) updateData.short_description = shortHtml;
          await wcUpdate(`/products/${product.id}`, updateData);
          await logWpChange(supabase, "speed-optimizer", `/wc/v3/products/${product.id}`, "PUT", "product", String(product.id),
            { description: desc, short_description: shortDesc },
            { description: descHtml, short_description: shortHtml });
        }

        results.push({
          type: "product",
          id: product.id,
          title: product.name || `Product #${product.id}`,
          changes: allChanges,
          images_fixed: allChanges.length,
        });
      }
    } catch (e) { console.error("Products scan error:", e); }
  }

  // Media Library Audit
  const mediaAudit: MediaAuditItem[] = [];
  if (includeMediaAudit) {
    try {
      const media = await wpGet("/media?per_page=100&media_type=image");
      for (const item of media) {
        const issues: string[] = [];
        const sourceUrl = item.source_url;
        let fileSize: number | null = null;
        let imgWidth = item.media_details?.width || null;
        let imgHeight = item.media_details?.height || null;

        try {
          const headRes = await fetch(sourceUrl, { method: "HEAD", redirect: "follow" });
          const cl = headRes.headers.get("content-length");
          if (cl) {
            fileSize = parseInt(cl, 10);
            if (fileSize > 500_000) {
              issues.push(`File size ${(fileSize / 1024).toFixed(0)} KB exceeds 500 KB`);
            }
          }
        } catch { /* skip */ }

        if (imgWidth && imgWidth > 2000) issues.push(`Width ${imgWidth}px exceeds 2000px`);
        if (imgHeight && imgHeight > 2000) issues.push(`Height ${imgHeight}px exceeds 2000px`);

        const mime = item.mime_type || "";
        if (mime && !mime.includes("webp") && !mime.includes("svg")) {
          issues.push("No WebP version available");
        }

        if (issues.length > 0) {
          mediaAudit.push({
            id: item.id,
            title: item.title?.rendered || `Media #${item.id}`,
            source_url: sourceUrl,
            file_size_bytes: fileSize,
            width: imgWidth,
            height: imgHeight,
            mime_type: mime,
            issues,
          });
        }
      }
    } catch (e) { console.error("Media audit error:", e); }
  }

  const summary = {
    ok: true,
    dry_run: dryRun,
    items_scanned: totalItemsScanned,
    items_modified: totalItemsModified,
    images_fixed: totalImagesFixed,
    results,
    media_audit: mediaAudit,
    media_audit_count: mediaAudit.length,
  };

  console.log(`🚀 Speed optimizer complete: ${totalItemsModified} items modified, ${totalImagesFixed} images fixed, ${mediaAudit.length} media flagged (dry_run=${dryRun})`);

  // For live mode: create tasks for radin for server-side issues
  if (!dryRun) {
    await createServerTasks(supabase, jobId);
  }

  // Log the summary to wp_change_log
  if (!dryRun && jobId) {
    try {
      await supabase.from("wp_change_log").insert({
        user_id: "speed-optimizer",
        endpoint: "/speed-optimizer/job",
        method: "POST",
        entity_type: "speed_job",
        entity_id: jobId,
        previous_state: {},
        new_state: summary,
        result: "success",
      });
    } catch (e: any) {
      console.error("Failed to log job result:", e.message);
    }
  }

  return summary;
}

async function createServerTasks(supabase: any, jobId: string | null) {
  console.log("📋 Creating server-side tasks for radin...");
  
  for (const task of SERVER_TASKS) {
    try {
      // Check if a similar task already exists and is not done
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("source", "speed-optimizer")
        .eq("title", task.title)
        .neq("status", "done")
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`⏭️ Task already exists: ${task.title}`);
        continue;
      }

      const { error } = await supabase.from("tasks").insert({
        title: task.title,
        description: task.description,
        status: "todo",
        priority: task.priority,
        assigned_to: RADIN_PROFILE_ID,
        company_id: COMPANY_ID,
        source: "speed-optimizer",
        source_ref: jobId || undefined,
        agent_type: "vizzy",
      });

      if (error) {
        console.error(`Failed to create task: ${task.title}`, error.message);
      } else {
        console.log(`✅ Task created: ${task.title}`);
      }
    } catch (e: any) {
      console.error(`Task creation error: ${e.message}`);
    }
  }
}

async function logWpChange(
  supabase: any, userId: string, endpoint: string, method: string,
  entityType: string, entityId: string, previousState: any, newState: any
) {
  try {
    await supabase.from("wp_change_log").insert({
      user_id: userId, endpoint, method,
      entity_type: entityType, entity_id: entityId,
      previous_state: previousState, new_state: newState,
      result: "success",
    });
  } catch (e: any) {
    console.error("wp_change_log error:", e.message);
  }
}
