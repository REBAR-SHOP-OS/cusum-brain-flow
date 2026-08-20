import { handleRequest } from "../_shared/requestHandler.ts";
import { WPClient } from "../_shared/wpClient.ts";
import { corsHeaders } from "../_shared/auth.ts";

const RSIC_RESOURCES = [
  { keywords: ["standard practice", "bar placing", "placing standard"], href: "https://rebar.org/manual-of-standard-practice/", anchor: "Manual of Standard Practice" },
  { keywords: ["reinforcing steel", "rebar industry", "steel reinforcement"], href: "https://rebar.org/", anchor: "Reinforcing Steel Institute of Canada" },
  { keywords: ["certification", "quality assurance", "certified"], href: "https://rebar.org/certification/", anchor: "RSIC Certification Program" },
  { keywords: ["bar supports", "bar chairs", "support system"], href: "https://rebar.org/bar-supports/", anchor: "RSIC Bar Supports Guide" },
  { keywords: ["epoxy coated", "corrosion protection", "epoxy-coated"], href: "https://rebar.org/epoxy-coated-rebar/", anchor: "Epoxy-Coated Reinforcing Steel" },
  { keywords: ["detailing", "bar bending schedule", "bending schedule"], href: "https://rebar.org/manual-of-standard-practice/", anchor: "Standard Detailing Practice" },
];

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: sb, body }) => {
    const { phase, domain_id, company_id, audit_ids } = body;

    if (phase === "crawl") {
      return await handleCrawl(sb, domain_id, company_id);
    } else if (phase === "check_broken") {
      return await handleCheckBroken(sb, domain_id);
    } else if (phase === "preview") {
      return await handlePreview(sb, audit_ids, company_id);
    } else if (phase === "fix") {
      return await handleFix(sb, audit_ids, company_id);
    }

    return new Response(JSON.stringify({ error: "Invalid phase" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }, { functionName: "seo-link-audit", authMode: "required", requireCompany: false, wrapResult: false })
);

// ─── AI HELPER ───

async function callAI(prompt: string, systemPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── CRAWL PHASE ───

async function handleCrawl(sb: any, domainId: string, companyId: string) {
  const wp = new WPClient();

  // Clear previous audit for this domain
  await sb.from("seo_link_audit").delete().eq("domain_id", domainId);

  // Fetch all content from WordPress
  const [pages, posts, products] = await Promise.all([
    fetchAllWP(wp, "pages"),
    fetchAllWP(wp, "posts"),
    fetchAllWPProducts(wp),
  ]);

  const allContent = [...pages, ...posts, ...products];
  const siteUrl = Deno.env.get("WP_BASE_URL")?.replace(/\/wp-json\/wp\/v2\/?$/, "") || "";
  console.log(`Crawling ${allContent.length} pages/posts/products`);

  const results: any[] = [];
  let siteHostname = "";
  try { siteHostname = siteUrl ? new URL(siteUrl).hostname : ""; } catch { /* ignore */ }

  for (const item of allContent) {
    const pageUrl = item.link || `${siteUrl}/?p=${item.id}`;
    const html = item.content?.rendered || "";
    if (!html) continue;

    const links = extractLinks(html);

    for (const link of links) {
      if (!link.href || link.href.startsWith("#") || link.href.startsWith("mailto:") || link.href.startsWith("tel:")) {
        continue;
      }

      const isInternal = link.href.startsWith("/") || (siteHostname && link.href.includes(siteHostname));
      const record: any = {
        domain_id: domainId,
        page_url: pageUrl,
        link_href: link.href,
        anchor_text: link.text || null,
        link_type: isInternal ? "internal" : "external",
        company_id: companyId,
        wp_item_id: item.id,
        wp_item_type: item.type || (item.link?.includes("/product/") ? "product" : "page"),
      };

      if (!link.text || link.text.trim() === "") {
        record.status = "missing_anchor";
        record.suggestion = "Add descriptive anchor text for SEO";
      } else {
        // Mark as "ok" initially; broken link detection happens in a separate check phase
        record.status = "ok";
      }

      results.push(record);
    }

    // RSIC opportunity detection
    const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
    const existingHrefs = links.map((l) => l.href);

    let rsicCount = 0;
    for (const resource of RSIC_RESOURCES) {
      if (rsicCount >= 2) break;
      if (existingHrefs.some((h) => h && h.includes("rebar.org"))) break;

      const matched = resource.keywords.some((kw) => textContent.includes(kw));
      if (matched) {
        results.push({
          domain_id: domainId,
          page_url: pageUrl,
          link_href: null,
          anchor_text: null,
          link_type: "rsic_opportunity",
          status: "opportunity",
          suggestion: `Add outbound link to "${resource.anchor}" — keyword match found in content`,
          suggested_href: resource.href,
          suggested_anchor: resource.anchor,
          company_id: companyId,
          wp_item_id: item.id,
          wp_item_type: item.type || "page",
        });
        rsicCount++;
      }
    }
  }

  console.log(`Collected ${results.length} link records, inserting...`);

  if (results.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const { error } = await sb.from("seo_link_audit").insert(batch);
      if (error) console.error("Insert error:", error.message);
    }
  }

  const stats = {
    total: results.length,
    broken: results.filter((r) => r.status === "broken").length,
    opportunities: results.filter((r) => r.status === "opportunity").length,
    missing_anchor: results.filter((r) => r.status === "missing_anchor").length,
    ok: results.filter((r) => r.status === "ok").length,
  };

  console.log(`Crawl complete:`, stats);

  return new Response(JSON.stringify({ success: true, stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── CHECK BROKEN PHASE ───

async function handleCheckBroken(sb: any, domainId: string) {
  // Get all external links that are currently "ok" (not yet checked)
  const { data: links } = await sb
    .from("seo_link_audit")
    .select("id, link_href")
    .eq("domain_id", domainId)
    .eq("link_type", "external")
    .eq("status", "ok")
    .limit(50); // Process 50 at a time

  if (!links || links.length === 0) {
    return new Response(JSON.stringify({ success: true, checked: 0, broken: 0, remaining: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Deduplicate URLs
  const urlMap = new Map<string, string[]>(); // href -> [ids]
  for (const link of links) {
    if (!link.link_href) continue;
    const existing = urlMap.get(link.link_href) || [];
    existing.push(link.id);
    urlMap.set(link.link_href, existing);
  }

  let brokenCount = 0;
  const uniqueUrls = Array.from(urlMap.keys());

  // Check in batches of 20 concurrently
  const BATCH = 20;
  for (let i = 0; i < uniqueUrls.length; i += BATCH) {
    const batch = uniqueUrls.slice(i, i + BATCH);
    const checks = await Promise.all(batch.map(async (url) => {
      try {
        const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(3000) });
        return { url, broken: res.status >= 400, status: res.status };
      } catch {
        return { url, broken: true, status: null };
      }
    }));

    for (const check of checks) {
      const ids = urlMap.get(check.url) || [];
      if (check.broken) {
        const suggestion = check.status ? `Link returns ${check.status}. Fix or remove.` : "Link unreachable or timed out";
        for (const id of ids) {
          await sb.from("seo_link_audit").update({ status: "broken", suggestion }).eq("id", id);
        }
        brokenCount += ids.length;
      } else {
        // Mark as "checked" so it won't be re-fetched in the next iteration
        for (const id of ids) {
          await sb.from("seo_link_audit").update({ status: "checked" }).eq("id", id);
        }
      }
    }
  }

  // Check how many remain
  const { count } = await sb
    .from("seo_link_audit")
    .select("id", { count: "exact", head: true })
    .eq("domain_id", domainId)
    .eq("link_type", "external")
    .eq("status", "ok");

  console.log(`Check complete: ${brokenCount} broken found, ${count || 0} remaining`);

  return new Response(JSON.stringify({ success: true, checked: links.length, broken: brokenCount, remaining: count || 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── PREVIEW PHASE (AI-powered) ───

async function handlePreview(sb: any, auditIds: string[], _companyId: string) {
  const wp = new WPClient();
  const proposals: any[] = [];

  // Cap at 10 items per call to prevent timeouts
  const capped = auditIds.slice(0, 10);

  for (const id of capped) {
    const { data: record } = await sb.from("seo_link_audit").select("*").eq("id", id).single();
    if (!record || record.is_fixed) continue;

    try {
      const wpItem = await findWPItemFromRecord(wp, record);
      if (!wpItem) {
        proposals.push({ id, error: "Could not find WordPress page/post for: " + record.page_url });
        continue;
      }

      const content = wpItem.content.rendered;

      if (record.status === "opportunity" && record.suggested_href) {
        // AI-powered opportunity placement
        const proposal = await generateOpportunityProposal(content, record);
        proposals.push({ id, type: "opportunity", ...proposal });
      } else if (record.status === "broken" && record.link_href) {
        // AI-powered broken link resolution
        const proposal = await generateBrokenLinkProposal(content, record);
        proposals.push({ id, type: "broken", ...proposal });
      }
    } catch (e) {
      console.error(`Preview error for ${id}:`, e);
      proposals.push({ id, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    proposals,
    total_requested: auditIds.length,
    processed: capped.length,
    remaining: Math.max(0, auditIds.length - 10),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateOpportunityProposal(html: string, record: any) {
  // Extract just the text paragraphs for context (limit size)
  const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const contextHtml = paragraphs.slice(0, 20).join("\n");

  const prompt = `You are an SEO expert. I need to add a link to "${record.suggested_href}" with anchor text "${record.suggested_anchor}" into this page content.

Here are the paragraphs of the page:
${contextHtml}

Rules:
1. Find the MOST contextually relevant paragraph for this link
2. Insert the link naturally within the existing text — do NOT add new sentences
3. The link should feel like it was always part of the content
4. Use the anchor text "${record.suggested_anchor}" or a natural variation that fits the sentence
5. Return ONLY a JSON object with these fields:
   - "before_paragraph": the original paragraph HTML (exact match)
   - "after_paragraph": the modified paragraph HTML with the link inserted
   - "reasoning": one sentence explaining why this placement was chosen

Return ONLY valid JSON, no markdown fences.`;

  const systemPrompt = "You are an SEO content editor. Return only valid JSON. No markdown.";
  const raw = await callAI(prompt, systemPrompt);
  return parseAIJson(raw);
}

async function generateBrokenLinkProposal(html: string, record: any) {
  // Find the surrounding context of the broken link
  const linkPattern = new RegExp(
    `<a[^>]*href=["']${escapeRegex(record.link_href)}["'][^>]*>[\\s\\S]*?<\\/a>`,
    "gi"
  );
  const match = linkPattern.exec(html);
  const brokenLinkHtml = match ? match[0] : "";

  // Find the paragraph containing the broken link
  const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const containingParagraph = paragraphs.find(p => p.includes(record.link_href)) || "";

  // Try Wayback Machine lookup
  let archiveUrl: string | null = null;
  try {
    const wbRes = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(record.link_href)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (wbRes.ok) {
      const wbData = await wbRes.json();
      archiveUrl = wbData?.archived_snapshots?.closest?.url || null;
    }
  } catch { /* ignore */ }

  // ── Smart replacement: search for real replacement URLs via Firecrawl ──
  let searchCandidates: { url: string; title: string; description: string }[] = [];
  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (firecrawlKey) {
      const anchorText = record.anchor_text || "";
      // Build a search query from anchor text + broken URL domain for context
      let searchDomain = "";
      try { searchDomain = new URL(record.link_href).hostname.replace("www.", ""); } catch { /* ignore */ }
      const searchQuery = `${anchorText} ${searchDomain}`.trim();

      if (searchQuery.length > 2) {
        console.log(`Firecrawl search for replacement: "${searchQuery}"`);
        const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: searchQuery, limit: 5 }),
          signal: AbortSignal.timeout(10000),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData?.data || searchData?.results || [];
          searchCandidates = results
            .filter((r: any) => r.url && r.url !== record.link_href)
            .slice(0, 3)
            .map((r: any) => ({
              url: r.url,
              title: r.title || r.metadata?.title || "",
              description: r.description || r.metadata?.description || "",
            }));
          console.log(`Found ${searchCandidates.length} replacement candidates`);
        }
      }
    }
  } catch (e) {
    console.warn("Firecrawl search failed (non-fatal):", e instanceof Error ? e.message : e);
  }

  const candidatesBlock = searchCandidates.length > 0
    ? `\nReplacement candidates found via web search:\n${searchCandidates.map((c, i) => `  ${i + 1}. ${c.url} — "${c.title}" — ${c.description}`).join("\n")}`
    : "\nNo replacement candidates found via web search.";

  const prompt = `You are an SEO expert fixing a broken link on a webpage.

Broken link: ${record.link_href}
Anchor text: ${record.anchor_text || "(no anchor text)"}
Broken link HTML: ${brokenLinkHtml}
Containing paragraph: ${containingParagraph}
${archiveUrl ? `Wayback Machine archive found: ${archiveUrl}` : "No Wayback Machine archive available."}
${candidatesBlock}

Decide the BEST action:
1. "replace" — Replace href with one of the replacement candidate URLs (ONLY if a candidate is relevant and high-quality)
2. "archive" — Replace href with the Wayback Machine archive URL (only if archive exists and no good replacement candidate)
3. "remove" — Remove the <a> tag but keep the text content (if no replacement or archive exists)
4. "unlink" — Remove the entire link and its text (only if it's spam or irrelevant)

Rules:
- PREFER "replace" if a replacement candidate is relevant — this preserves SEO link equity
- If replacing, use the BEST matching candidate URL
- Use "archive" only if no good replacement exists but archive does
- Use "remove" (keep text, drop link) if no replacement or archive
- Use "unlink" only for spam or completely irrelevant links

Return ONLY a JSON object:
- "action": "replace" | "archive" | "remove" | "unlink"
- "replacement_url": the chosen replacement URL (only if action is "replace")
- "before_paragraph": the original paragraph HTML
- "after_paragraph": the modified paragraph HTML with the fix applied
- "reasoning": one sentence explaining the decision

Return ONLY valid JSON, no markdown fences.`;

  const systemPrompt = "You are an SEO content editor. Return only valid JSON. No markdown.";
  const raw = await callAI(prompt, systemPrompt);
  return parseAIJson(raw);
}

function parseAIJson(raw: string): any {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  // Find JSON boundaries
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    return { error: "AI returned invalid format", raw_response: raw.slice(0, 500) };
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try removing trailing commas
    const repaired = jsonStr.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      return { error: "Could not parse AI response", raw_response: raw.slice(0, 500) };
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── FIX PHASE (AI-powered) ───

async function handleFix(sb: any, auditIds: string[], companyId: string) {
  const wp = new WPClient();
  const fixed: string[] = [];
  const errors: string[] = [];

  for (const id of auditIds) {
    const { data: record } = await sb.from("seo_link_audit").select("*").eq("id", id).single();
    if (!record || record.is_fixed) continue;

    try {
      const wpItem = await findWPItemFromRecord(wp, record);
      if (!wpItem) {
        errors.push(id);
        continue;
      }

      const content = wpItem.content.rendered;
      let updatedContent = content;

      if (record.status === "opportunity" && record.suggested_href) {
        const proposal = await generateOpportunityProposal(content, record);
        if (proposal.before_paragraph && proposal.after_paragraph && !proposal.error) {
          updatedContent = content.replace(proposal.before_paragraph, proposal.after_paragraph);
        }
      } else if (record.status === "broken" && record.link_href) {
        const proposal = await generateBrokenLinkProposal(content, record);
        if (proposal.before_paragraph && proposal.after_paragraph && !proposal.error) {
          updatedContent = content.replace(proposal.before_paragraph, proposal.after_paragraph);
        }
      }

      if (updatedContent !== content) {
        await updateWPContent(wp, wpItem, updatedContent);
        const changeType = record.status === "broken" ? "broken_link_fixed" : "rsic_link_added";
        const detail = record.status === "broken" ? record.link_href : record.suggested_href;
        await logChange(sb, companyId, wpItem, changeType, detail);
      }

      await sb.from("seo_link_audit").update({ is_fixed: true }).eq("id", id);
      fixed.push(id);
    } catch (e) {
      console.error(`Fix error for ${id}:`, e);
      errors.push(id);
    }
  }

  return new Response(JSON.stringify({ success: true, fixed: fixed.length, errors: errors.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── HELPERS ───

function extractLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const regex = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.push({
      href: match[1],
      text: match[2].replace(/<[^>]+>/g, "").trim(),
    });
  }
  return links;
}

async function fetchAllWP(wp: WPClient, type: "pages" | "posts"): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    try {
      const items = type === "pages"
        ? await wp.listPages({ per_page: "50", page: String(page) })
        : await wp.listPosts({ per_page: "50", page: String(page) });
      if (!items || items.length === 0) break;
      all.push(...items);
      if (items.length < 50) break;
      page++;
    } catch {
      break;
    }
  }
  return all;
}

async function fetchAllWPProducts(wp: WPClient): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    try {
      const items = await wp.listProducts({ per_page: "50", page: String(page) });
      if (!items || items.length === 0) break;
      all.push(...items.map((p: any) => ({ ...p, content: { rendered: p.description || "" } })));
      if (items.length < 50) break;
      page++;
    } catch {
      break;
    }
  }
  return all;
}

/** Try to resolve WP item using stored wp_item_id first, then slug fallback */
async function findWPItemFromRecord(wp: WPClient, record: any): Promise<any | null> {
  // 1) Direct ID lookup if stored during crawl
  if (record.wp_item_id) {
    try {
      const itemType = record.wp_item_type || "page";
      if (itemType === "page") {
        const page = await wp.getPage(String(record.wp_item_id));
        if (page) return { ...page, type: "page" };
      } else if (itemType === "post") {
        const post = await wp.getPost(String(record.wp_item_id));
        if (post) return { ...post, type: "post" };
      } else if (itemType === "product") {
        const product = await wp.getProduct(String(record.wp_item_id));
        if (product) return { ...product, type: "product", content: { rendered: product.description || "" } };
      }
    } catch (e) {
      console.warn(`Direct WP item lookup failed for ID ${record.wp_item_id}:`, e);
    }
  }

  // 2) Slug-based fallback
  return findWPItemBySlug(wp, record.page_url);
}

async function findWPItemBySlug(wp: WPClient, pageUrl: string): Promise<any | null> {
  let url: URL;
  try { url = new URL(pageUrl); } catch { return null; }
  const slug = url.pathname.replace(/^\/|\/$/g, "").split("/").pop() || "";

  // Handle homepage (empty slug)
  if (!slug) {
    try {
      // Try common homepage slugs
      for (const trySlug of ["home", "homepage", "front-page"]) {
        const pages = await wp.listPages({ slug: trySlug, per_page: "1" });
        if (pages && pages.length > 0) return { ...pages[0], type: "page" };
      }
      // Try fetching the front page (page on front in WP settings — usually ID from reading settings)
      // Fallback: get the first page ordered by menu_order
      const frontPages = await wp.listPages({ orderby: "menu_order", order: "asc", per_page: "1" });
      if (frontPages && frontPages.length > 0) return { ...frontPages[0], type: "page" };
    } catch { /* ignore */ }
    console.warn(`findWPItem: Could not resolve homepage for ${pageUrl}`);
    return null;
  }

  try {
    const pages = await wp.listPages({ slug, per_page: "1" });
    if (pages && pages.length > 0) return { ...pages[0], type: "page" };
  } catch { /* ignore */ }

  try {
    const posts = await wp.listPosts({ slug, per_page: "1" });
    if (posts && posts.length > 0) return { ...posts[0], type: "post" };
  } catch { /* ignore */ }

  return null;
}

async function updateWPContent(wp: WPClient, item: any, content: string) {
  if (item.type === "page") {
    await wp.updatePage(String(item.id), { content });
  } else {
    await wp.updatePost(String(item.id), { content });
  }
}

async function logChange(sb: any, companyId: string, item: any, changeType: string, detail: string) {
  await sb.from("wp_change_log").insert({
    company_id: companyId,
    entity_type: item.type || "page",
    entity_id: String(item.id),
    change_type: changeType,
    change_summary: `SEO fix: ${detail}`,
    changed_by: "seo-link-audit",
  }).then(({ error }: any) => {
    if (error) console.error("Log error:", error.message);
  });
}
