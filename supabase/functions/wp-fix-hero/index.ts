import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { WPClient } from "../_shared/wpClient.ts";

const PAGE_ID = "13672";
const HERO_ID = "rebar-static-hero";

const BANNER_IMAGES = [
  "https://rebar.shop/wp-content/uploads/rebar-estimation-banner-1920-vivid.webp",
  "https://rebar.shop/wp-content/uploads/shop-drawings-ultra-hq-scaled.webp",
  "https://rebar.shop/wp-content/uploads/rebar-detailing-high-quality-1.webp",
  "https://rebar.shop/wp-content/uploads/dowel-rebar-blue-chalkboard.webp",
  "https://rebar.shop/wp-content/uploads/spring_build_bonus_offer_sale.webp",
  "https://rebar.shop/wp-content/uploads/rebar-stirrups-sale.webp",
  "https://rebar.shop/wp-content/uploads/straight-rebar-sale-1.webp",
  "https://rebar.shop/wp-content/uploads/custom_rebar_high_quality-1.webp",
];

function buildHeroHTML(): string {
  const totalDuration = BANNER_IMAGES.length * 5; // 5s per slide
  const pct = 100 / BANNER_IMAGES.length;
  const fadeIn = 1.5; // fade % per slide
  const fadePct = (fadeIn / totalDuration) * 100;

  const keyframes = BANNER_IMAGES.map((_, i) => {
    const start = i * pct;
    const visible = start + fadePct;
    const end = (i + 1) * pct - fadePct;
    const fadeOut = (i + 1) * pct;
    return `${start.toFixed(1)}% { opacity: 0; }
${visible.toFixed(1)}% { opacity: 1; }
${end.toFixed(1)}% { opacity: 1; }
${fadeOut.toFixed(1)}% { opacity: 0; }`;
  }).join("\n");

  const slides = BANNER_IMAGES.map((url, i) => {
    const delay = i * 5;
    return `<div class="rsh-slide" style="background-image:url('${url}');animation-delay:${delay}s;"></div>`;
  }).join("\n");

  return `
<!-- REBAR STATIC HERO — injected by wp-fix-hero -->
<style>
#${HERO_ID} {
  position: relative;
  width: 100%;
  height: 600px;
  overflow: hidden;
  background: #111;
}
@media (max-width: 768px) {
  #${HERO_ID} { height: 350px; }
}
#${HERO_ID} .rsh-slide {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0;
  animation: rshFade ${totalDuration}s infinite;
}
#${HERO_ID} .rsh-slide:first-child {
  opacity: 1;
}
@keyframes rshFade {
${keyframes}
}
#${HERO_ID} .rsh-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.35);
  z-index: 2;
  text-align: center;
  color: #fff;
  padding: 20px;
}
#${HERO_ID} .rsh-overlay h1 {
  font-size: clamp(1.8rem, 5vw, 3.5rem);
  font-weight: 800;
  margin: 0 0 12px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
#${HERO_ID} .rsh-overlay p {
  font-size: clamp(1rem, 2.5vw, 1.4rem);
  margin: 0 0 20px;
  max-width: 700px;
}
#${HERO_ID} .rsh-btn {
  display: inline-block;
  padding: 14px 36px;
  background: #f59e0b;
  color: #000;
  font-weight: 700;
  font-size: 1.1rem;
  border-radius: 6px;
  text-decoration: none;
  transition: background 0.2s;
}
#${HERO_ID} .rsh-btn:hover { background: #d97706; }
</style>
<div id="${HERO_ID}">
${slides}
<div class="rsh-overlay">
<div>
<h1>Premium Rebar Solutions</h1>
<p>Custom cut & bent reinforcing steel — delivered to your jobsite across Canada</p>
<a href="/shop/" class="rsh-btn">Shop Now</a>
</div>
</div>
</div>
<!-- END REBAR STATIC HERO -->
`;
}

serve((req) =>
  handleRequest(req, async (ctx) => {
    const { log, body } = ctx;
    const wp = new WPClient();

    // GET mode: check current state
    if (ctx.req.method === "GET") {
      const page = await wp.getPage(PAGE_ID);
      const hasHero = (page.content?.rendered || "").includes(HERO_ID);
      return { pageId: PAGE_ID, hasStaticHero: hasHero, title: page.title?.rendered };
    }

    // POST mode: inject hero
    const action = body.action || "inject";

    if (action === "remove") {
      log.info("Removing static hero from page", { pageId: PAGE_ID });
      const page = await wp.getPage(PAGE_ID);
      const raw = page.content?.raw || page.content?.rendered || "";
      const cleaned = raw
        .replace(/<!-- REBAR STATIC HERO[\s\S]*?END REBAR STATIC HERO -->/g, "")
        .trim();
      await wp.updatePage(PAGE_ID, { content: cleaned });
      return { removed: true };
    }

    // Inject
    log.info("Injecting static hero into page", { pageId: PAGE_ID });
    const page = await wp.getPage(PAGE_ID);
    const raw = page.content?.raw || page.content?.rendered || "";

    if (raw.includes(HERO_ID)) {
      log.info("Hero already exists, skipping injection");
      return { alreadyExists: true };
    }

    const heroHtml = buildHeroHTML();

    // Hide the broken Slider Revolution module with CSS
    const hideSR = `<style>.sr7-module, rs-module-wrap { display: none !important; }</style>`;

    const updatedContent = heroHtml + "\n" + hideSR + "\n" + raw;
    await wp.updatePage(PAGE_ID, { content: updatedContent });

    log.done("Static hero injected successfully");
    return { injected: true, pageId: PAGE_ID };
  }, {
    functionName: "wp-fix-hero",
    requireCompany: true,
    requireAnyRole: ["admin", "office"],
    wrapResult: false,
  })
);
