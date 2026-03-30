import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { WPClient } from "../_shared/wpClient.ts";

const PAGE_ID = "13672";
const FIX_MARKER = "REBAR SR7 CSS FIX";
const SITE_ORIGIN = "https://rebar.shop";

/**
 * Fetches the live homepage HTML and parses SR7 slide IDs + image URLs
 * from the <image_lists> element and sr7-slide elements.
 */
async function parseSliderData(): Promise<{ slideIds: string[]; imageUrls: string[] }> {
  const res = await fetch(SITE_ORIGIN, {
    headers: { "User-Agent": "Mozilla/5.0 (RebarBot)" },
  });
  const html = await res.text();

  // Extract image URLs from <image_lists> — pattern: data-src="..." or src="..."
  const imageListMatch = html.match(/<image_lists[^>]*>([\s\S]*?)<\/image_lists>/i);
  const imageUrls: string[] = [];
  if (imageListMatch) {
    const imgRegex = /(?:data-src|src)="([^"]+)"/g;
    let m;
    while ((m = imgRegex.exec(imageListMatch[1])) !== null) {
      if (!imageUrls.includes(m[1])) {
        imageUrls.push(m[1]);
      }
    }
  }

  // Extract slide IDs — pattern: <sr7-slide id="SR7_6_1-47" ...>
  const slideIds: string[] = [];
  const slideRegex = /<sr7-slide[^>]+id="([^"]+)"/g;
  let s;
  while ((s = slideRegex.exec(html)) !== null) {
    slideIds.push(s[1]);
  }

  return { slideIds, imageUrls };
}

/**
 * Build CSS rules that force background images on each SR7 slide's bg layer.
 * SR7 creates a child element with id "{slideId}-2" as the bg layer.
 */
function buildCss(slideIds: string[], imageUrls: string[]): string {
  const rules: string[] = [];
  const count = Math.min(slideIds.length, imageUrls.length);

  for (let i = 0; i < count; i++) {
    const bgId = `${slideIds[i]}-2`;
    const url = imageUrls[i];
    rules.push(
      `#${bgId} { background-image: url(${url}) !important; background-size: cover !important; background-position: center !important; width: 100% !important; height: 100% !important; }`
    );
  }

  // Make the first slide visible immediately
  rules.push(`sr7-slide:first-of-type { opacity: 1 !important; }`);
  // Ensure the module wrapper is visible
  rules.push(`rs-module-wrap, sr7-module { min-height: 500px !important; }`);

  return rules.join("\n");
}

serve((req) =>
  handleRequest(req, async (ctx) => {
    const { log, body } = ctx;
    const wp = new WPClient();

    // GET mode: check current state
    if (ctx.req.method === "GET") {
      const page = await wp.getPage(PAGE_ID);
      const raw = page.content?.rendered || "";
      const hasFix = raw.includes(FIX_MARKER);

      let sliderData = null;
      try {
        sliderData = await parseSliderData();
      } catch (e) {
        log.info("Could not parse slider data from live site", { error: String(e) });
      }

      return {
        pageId: PAGE_ID,
        hasCssFix: hasFix,
        title: page.title?.rendered,
        sliderData,
      };
    }

    // POST mode
    const action = body.action || "inject";

    if (action === "remove") {
      log.info("Removing SR7 CSS fix from page", { pageId: PAGE_ID });
      const page = await wp.getPage(PAGE_ID);
      const raw = page.content?.raw || page.content?.rendered || "";
      const cleaned = raw
        .replace(new RegExp(`<!-- ${FIX_MARKER} -->[\\s\\S]*?<!-- END ${FIX_MARKER} -->`, "g"), "")
        // Also clean up old script-based fixes
        .replace(/<!-- REBAR SR7 FIX -->[\s\S]*?<!-- END REBAR SR7 FIX -->/g, "")
        .replace(/<!-- REBAR STATIC HERO[\s\S]*?END REBAR STATIC HERO -->/g, "")
        .replace(/<style>\.sr7-module,\s*rs-module-wrap\s*\{\s*display:\s*none\s*!important;\s*\}<\/style>/g, "")
        .trim();
      await wp.updatePage(PAGE_ID, { content: cleaned });
      return { removed: true };
    }

    // Inject CSS fix
    log.info("Injecting SR7 CSS fix into page", { pageId: PAGE_ID });

    // 1. Parse live site for slide data
    const { slideIds, imageUrls } = await parseSliderData();
    if (!slideIds.length || !imageUrls.length) {
      throw new Error(`Could not parse slider data from live site. Found ${slideIds.length} slides, ${imageUrls.length} images.`);
    }
    log.info("Parsed slider data", { slides: slideIds.length, images: imageUrls.length });

    // 2. Get current page content
    const page = await wp.getPage(PAGE_ID);
    let raw = page.content?.raw || page.content?.rendered || "";

    // 3. Clean up any old fixes
    raw = raw
      .replace(new RegExp(`<!-- ${FIX_MARKER} -->[\\s\\S]*?<!-- END ${FIX_MARKER} -->`, "g"), "")
      .replace(/<!-- REBAR SR7 FIX -->[\s\S]*?<!-- END REBAR SR7 FIX -->/g, "")
      .replace(/<!-- REBAR STATIC HERO[\s\S]*?END REBAR STATIC HERO -->/g, "")
      .replace(/<style>\.sr7-module,\s*rs-module-wrap\s*\{\s*display:\s*none\s*!important;\s*\}<\/style>/g, "")
      .trim();

    // 4. Build and inject CSS (WP preserves <style> tags, unlike <script>)
    const css = buildCss(slideIds, imageUrls);
    const styleBlock = `<!-- ${FIX_MARKER} -->\n<style>\n${css}\n</style>\n<!-- END ${FIX_MARKER} -->`;

    const updatedContent = styleBlock + "\n" + raw;
    await wp.updatePage(PAGE_ID, { content: updatedContent });

    log.done("SR7 CSS fix injected successfully", {
      slideCount: slideIds.length,
      imageCount: imageUrls.length,
    });

    return {
      injected: true,
      pageId: PAGE_ID,
      slideIds,
      imageUrls,
    };
  }, {
    functionName: "wp-fix-hero",
    requireCompany: true,
    requireAnyRole: ["admin", "office"],
    wrapResult: false,
  })
);
