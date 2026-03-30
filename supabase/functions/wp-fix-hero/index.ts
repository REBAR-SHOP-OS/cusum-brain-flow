import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { WPClient } from "../_shared/wpClient.ts";

const PAGE_ID = "13672";
const FIX_MARKER = "REBAR SR7 FIX";
const OLD_HERO_ID = "rebar-static-hero";

function buildRepairScript(): string {
  return `
<!-- ${FIX_MARKER} -->
<script>
(function(){
  function repairSlider(){
    var mod=document.querySelector('sr7-module');
    if(!mod)return;
    var imgs=mod.querySelectorAll('image_lists img');
    var slides=mod.querySelectorAll('sr7-slide');
    if(!imgs.length||!slides.length)return;
    imgs.forEach(function(img,i){
      if(i>=slides.length)return;
      var src=img.getAttribute('data-src')||img.getAttribute('src')||'';
      if(!src)return;
      var bg=slides[i].querySelector('sr7-bg');
      if(bg){
        bg.style.backgroundImage='url('+src+')';
        bg.style.backgroundSize='cover';
        bg.style.backgroundPosition='center';
        bg.style.width='100%';
        bg.style.height='100%';
      }
    });
    if(slides[0])slides[0].style.opacity='1';
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){setTimeout(repairSlider,500);});
  }else{
    setTimeout(repairSlider,500);
  }
  // Fallback: retry after 3s in case SR7 JS resets backgrounds
  setTimeout(repairSlider,3000);
  // MutationObserver: reapply if SR7 clears bg
  var obs=new MutationObserver(function(){repairSlider();});
  var target=document.querySelector('rs-module-wrap')||document.body;
  obs.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
})();
</script>
<!-- END ${FIX_MARKER} -->
`;
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
      const hasOldHero = raw.includes(OLD_HERO_ID);
      return { pageId: PAGE_ID, hasRepairScript: hasFix, hasOldStaticHero: hasOldHero, title: page.title?.rendered };
    }

    // POST mode
    const action = body.action || "inject";

    if (action === "remove") {
      log.info("Removing SR7 repair script from page", { pageId: PAGE_ID });
      const page = await wp.getPage(PAGE_ID);
      const raw = page.content?.raw || page.content?.rendered || "";
      const cleaned = raw
        .replace(new RegExp(`<!-- ${FIX_MARKER}[\\s\\S]*?END ${FIX_MARKER} -->`, "g"), "")
        .replace(/<!-- REBAR STATIC HERO[\s\S]*?END REBAR STATIC HERO -->/g, "")
        .replace(/<style>\.sr7-module,\s*rs-module-wrap\s*\{\s*display:\s*none\s*!important;\s*\}<\/style>/g, "")
        .trim();
      await wp.updatePage(PAGE_ID, { content: cleaned });
      return { removed: true };
    }

    // Inject repair script
    log.info("Injecting SR7 repair script into page", { pageId: PAGE_ID });
    const page = await wp.getPage(PAGE_ID);
    let raw = page.content?.raw || page.content?.rendered || "";

    // Clean up old static hero and hide CSS if present
    raw = raw
      .replace(/<!-- REBAR STATIC HERO[\s\S]*?END REBAR STATIC HERO -->/g, "")
      .replace(/<style>\.sr7-module,\s*rs-module-wrap\s*\{\s*display:\s*none\s*!important;\s*\}<\/style>/g, "")
      .trim();

    if (raw.includes(FIX_MARKER)) {
      log.info("Repair script already exists, skipping injection");
      return { alreadyExists: true };
    }

    const script = buildRepairScript();
    const updatedContent = script + "\n" + raw;
    await wp.updatePage(PAGE_ID, { content: updatedContent });

    log.done("SR7 repair script injected successfully");
    return { injected: true, pageId: PAGE_ID };
  }, {
    functionName: "wp-fix-hero",
    requireCompany: true,
    requireAnyRole: ["admin", "office"],
    wrapResult: false,
  })
);
