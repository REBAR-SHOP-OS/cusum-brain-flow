import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  // Collect all img tags with their positions for async processing
  const imgMatches: Array<{ match: string; attrs: string; index: number }> = [];
  const imgRegex = /<img([^>]*)>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    imgMatches.push({ match: m[0], attrs: m[1], index: m.index });
  }

  // Process each image (some need async dimension fetch)
  const replacements: Array<{ original: string; replacement: string }> = [];

  for (const img of imgMatches) {
    imgIndex++;
    let newAttrs = img.attrs;
    let modified = false;
    const isAboveFold = isFirstContent && imgIndex === 1;

    // 1. fetchpriority="high" for hero images
    if (isAboveFold && !/fetchpriority\s*=/i.test(newAttrs)) {
      newAttrs += ' fetchpriority="high"';
      changes.push(`Image #${imgIndex}: added fetchpriority="high"`);
      modified = true;
    }

    // 2. loading="lazy" for non-hero images
    if (!isAboveFold && !/loading\s*=/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
      changes.push(`Image #${imgIndex}: added loading="lazy"`);
      modified = true;
    }

    // 3. decoding="async"
    if (!/decoding\s*=/i.test(newAttrs)) {
      newAttrs += ' decoding="async"';
      changes.push(`Image #${imgIndex}: added decoding="async"`);
      modified = true;
    }

    // 4. Inject width/height if missing
    const hasDims = /width\s*=/i.test(newAttrs) && /height\s*=/i.test(newAttrs);
    if (!hasDims) {
      const src = extractSrc(newAttrs);
      if (src) {
        try {
          const dims = await getImageDimensions(src);
          if (dims) {
            if (!/width\s*=/i.test(newAttrs)) {
              newAttrs += ` width="${dims.width}"`;
            }
            if (!/height\s*=/i.test(newAttrs)) {
              newAttrs += ` height="${dims.height}"`;
            }
            changes.push(`Image #${imgIndex}: injected dimensions ${dims.width}×${dims.height}`);
            modified = true;
          }
        } catch {
          // Skip dimension injection on error
        }
      }
    }

    if (modified) imagesFixed++;
    replacements.push({ original: img.match, replacement: `<img${newAttrs}>` });
  }

  // Apply replacements in reverse order to preserve positions
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

    // Helper to process a content field
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

    // Process WooCommerce products (description + short_description)
    if (contentTypes.includes("products")) {
      try {
        const products = await wcGet("/products");
        for (const product of products) {
          totalItemsScanned++;
          // Process description
          const desc = product.description || "";
          let descHtml = desc;
          let descChanges: string[] = [];
          if (desc && /<img/i.test(desc)) {
            const r = await optimizeImgTags(desc, false);
            descHtml = r.html;
            descChanges = r.changes;
            totalImagesFixed += r.imagesFixed;
          }

          // Process short_description
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

          // Check file size via HEAD
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

          // Check dimensions
          if (imgWidth && imgWidth > 2000) issues.push(`Width ${imgWidth}px exceeds 2000px`);
          if (imgHeight && imgHeight > 2000) issues.push(`Height ${imgHeight}px exceeds 2000px`);

          // Check for WebP
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

    return new Response(JSON.stringify(summary), {
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
