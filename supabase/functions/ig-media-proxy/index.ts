// IG Media Proxy
// Re-serves a public Supabase Storage asset as a clean image/jpeg URL.
// Purpose: eliminate Meta "code 2 / unexpected error" caused by Cloudflare
// bot-management cookies, content-type quirks, or PNG-specific edge cases on
// Instagram Graph API's container fetcher. Re-encodes PNG → JPEG, passes JPEG
// through, and serves with aggressive caching so Meta gets a clean stable URL.
//
// Security: only proxies URLs from the project's Supabase Storage host. No
// secrets, no auth — pure read-through proxy.

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const ALLOWED_HOST_SUFFIX = ".supabase.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const src = url.searchParams.get("src");
    if (!src) {
      return new Response("missing src", { status: 400, headers: corsHeaders });
    }

    let srcUrl: URL;
    try {
      srcUrl = new URL(src);
    } catch {
      return new Response("invalid src", { status: 400, headers: corsHeaders });
    }
    if (!srcUrl.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
      return new Response("src host not allowed", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const upstream = await fetch(srcUrl.toString());
    if (!upstream.ok) {
      return new Response(`upstream ${upstream.status}`, {
        status: 502,
        headers: corsHeaders,
      });
    }

    const upstreamType = (upstream.headers.get("content-type") || "")
      .toLowerCase();
    const bytes = new Uint8Array(await upstream.arrayBuffer());

    const isPng = upstreamType.includes("png") ||
      (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
        bytes[3] === 0x47);
    const isJpeg = upstreamType.includes("jpeg") ||
      upstreamType.includes("jpg") ||
      (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff);

    let outBytes: Uint8Array;
    let outType: string;

    if (isJpeg) {
      outBytes = bytes;
      outType = "image/jpeg";
    } else if (isPng) {
      // Re-encode PNG → JPEG to give Meta the format its ingestion pipeline
      // handles most reliably. Quality 90 is visually lossless for social.
      try {
        const img = await Image.decode(bytes);
        outBytes = await img.encodeJPEG(90);
        outType = "image/jpeg";
      } catch (e) {
        console.error(
          `[ig-media-proxy] PNG re-encode failed, passing through: ${
            (e as Error).message
          }`,
        );
        outBytes = bytes;
        outType = "image/png";
      }
    } else {
      // Unknown — pass through with detected upstream type.
      outBytes = bytes;
      outType = upstreamType || "application/octet-stream";
    }

    return new Response(outBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": outType,
        "Content-Length": String(outBytes.byteLength),
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[ig-media-proxy] error:", (e as Error).message);
    return new Response(`proxy error: ${(e as Error).message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
