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

// Fetch image dimensions via HEAD request
async function getImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    // Some servers return content dimensions in headers
    const cl = res.headers.get("content-length");
    if (!cl) return null;
    // Fallback: fetch first bytes to detect dimensions from binary
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
      // VP8
      if (buf[15] === 0x20 && buf.length > 29) {
        const width = ((buf[26] | (buf[27] << 8)) & 0x3FFF);
        const height = ((buf[28] | (buf[29] << 8)) & 0x3FFF);
        if (width > 0 && height > 0) return { width, height };
      }
    }
  }
  return null;
}

function optimizeImgTags(html: string, isFirstContent: boolean): { html: string; changes: string[]; imagesFixed: number } {
  const changes: string[] = [];
  let imagesFixed = 0;
  let imgIndex = 0;

  const result = html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    let modified = false;
    let newAttrs = attrs;
    imgIndex++;

    // Skip first image (likely hero/above-the-fold) only on first content block
    const isAboveFold = isFirstContent && imgIndex === 1;

    // Add loading="lazy" (skip above-fold images)
    if (!isAboveFold && !/loading\s*=/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
      changes.push(`Image #${imgIndex}: added loading="lazy"`);
      modified = true;
    }

    // Add decoding="async"
    if (!/decoding\s*=/i.test(newAttrs)) {
      newAttrs += ' decoding="async"';
      changes.push(`Image #${imgIndex}: added decoding="async"`);
      modified = true;
    }

    if (modified) imagesFixed++;
    return `<img${newAttrs}>`;
  });

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
    const dryRun = body.dry_run !== false; // Default to dry-run
    const contentTypes = body.content_types || ["posts", "pages", "products"];

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

    // Helper: fetch WP REST API
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

    // Helper: fetch WC REST API
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

    // Process posts
    if (contentTypes.includes("posts")) {
      try {
        const posts = await wpGet("/posts?per_page=100&status=publish");
        for (const post of posts) {
          totalItemsScanned++;
          const content = post.content?.rendered || post.content?.raw || "";
          if (!content || !/<img/i.test(content)) continue;

          const { html, changes, imagesFixed } = optimizeImgTags(content, true);
          if (changes.length === 0) continue;

          totalItemsModified++;
          totalImagesFixed += imagesFixed;

          if (!dryRun) {
            await wpUpdate(`/posts/${post.id}`, { content: html });
            await logWpChange(supabase, "speed-optimizer", `/posts/${post.id}`, "PUT", "post", String(post.id), { content }, { content: html });
          }

          results.push({
            type: "post",
            id: post.id,
            title: post.title?.rendered || `Post #${post.id}`,
            changes,
            images_fixed: imagesFixed,
          });
        }
      } catch (e) {
        console.error("Posts scan error:", e);
      }
    }

    // Process pages
    if (contentTypes.includes("pages")) {
      try {
        const pages = await wpGet("/pages?per_page=100&status=publish");
        for (const page of pages) {
          totalItemsScanned++;
          const content = page.content?.rendered || page.content?.raw || "";
          if (!content || !/<img/i.test(content)) continue;

          const { html, changes, imagesFixed } = optimizeImgTags(content, true);
          if (changes.length === 0) continue;

          totalItemsModified++;
          totalImagesFixed += imagesFixed;

          if (!dryRun) {
            await wpUpdate(`/pages/${page.id}`, { content: html });
            await logWpChange(supabase, "speed-optimizer", `/pages/${page.id}`, "PUT", "page", String(page.id), { content }, { content: html });
          }

          results.push({
            type: "page",
            id: page.id,
            title: page.title?.rendered || `Page #${page.id}`,
            changes,
            images_fixed: imagesFixed,
          });
        }
      } catch (e) {
        console.error("Pages scan error:", e);
      }
    }

    // Process WooCommerce products
    if (contentTypes.includes("products")) {
      try {
        const products = await wcGet("/products");
        for (const product of products) {
          totalItemsScanned++;
          const content = product.description || "";
          if (!content || !/<img/i.test(content)) continue;

          const { html, changes, imagesFixed } = optimizeImgTags(content, false);
          if (changes.length === 0) continue;

          totalItemsModified++;
          totalImagesFixed += imagesFixed;

          if (!dryRun) {
            await wcUpdate(`/products/${product.id}`, { description: html });
            await logWpChange(supabase, "speed-optimizer", `/wc/v3/products/${product.id}`, "PUT", "product", String(product.id), { description: content }, { description: html });
          }

          results.push({
            type: "product",
            id: product.id,
            title: product.name || `Product #${product.id}`,
            changes,
            images_fixed: imagesFixed,
          });
        }
      } catch (e) {
        console.error("Products scan error:", e);
      }
    }

    const summary = {
      ok: true,
      dry_run: dryRun,
      items_scanned: totalItemsScanned,
      items_modified: totalItemsModified,
      images_fixed: totalImagesFixed,
      results,
    };

    console.log(`🚀 Speed optimizer complete: ${totalItemsModified} items modified, ${totalImagesFixed} images fixed (dry_run=${dryRun})`);

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
      user_id: userId,
      endpoint,
      method,
      entity_type: entityType,
      entity_id: entityId,
      previous_state: previousState,
      new_state: newState,
      result: "success",
    });
  } catch (e: any) {
    console.error("wp_change_log error:", e.message);
  }
}
