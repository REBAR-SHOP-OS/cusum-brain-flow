import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WPClient } from "../_shared/wpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RSIC_RESOURCES = [
  { keywords: ["standard practice", "bar placing", "placing standard"], href: "https://rebar.org/manual-of-standard-practice/", anchor: "Manual of Standard Practice" },
  { keywords: ["reinforcing steel", "rebar industry", "steel reinforcement"], href: "https://rebar.org/", anchor: "Reinforcing Steel Institute of Canada" },
  { keywords: ["certification", "quality assurance", "certified"], href: "https://rebar.org/certification/", anchor: "RSIC Certification Program" },
  { keywords: ["bar supports", "bar chairs", "support system"], href: "https://rebar.org/bar-supports/", anchor: "RSIC Bar Supports Guide" },
  { keywords: ["epoxy coated", "corrosion protection", "epoxy-coated"], href: "https://rebar.org/epoxy-coated-rebar/", anchor: "Epoxy-Coated Reinforcing Steel" },
  { keywords: ["detailing", "bar bending schedule", "bending schedule"], href: "https://rebar.org/manual-of-standard-practice/", anchor: "Standard Detailing Practice" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phase, domain_id, company_id, audit_ids } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    if (phase === "crawl") {
      return await handleCrawl(sb, domain_id, company_id);
    } else if (phase === "preview") {
      return await handlePreview(sb, audit_ids, company_id);
    } else if (phase === "fix") {
      return await handleFix(sb, audit_ids, company_id);
    }

    return new Response(JSON.stringify({ error: "Invalid phase" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-link-audit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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

async function checkLink(href: string, siteUrl: string): Promise<{ status: number | null; error: boolean }> {
  try {
    const url = href.startsWith("/") ? `${siteUrl}${href}` : href;
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(3000),
    });
    return { status: res.status, error: res.status >= 400 };
  } catch {
    return { status: null, error: true };
  }
}

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
  console.log(`Crawling ${allContent.length} pages/posts/products`);

  const results: any[] = [];
  const siteUrl = Deno.env.get("WP_BASE_URL")?.replace(/\/wp-json\/wp\/v2\/?$/, "") || "";

  // Collect all link records first (no network calls yet)
  type PendingRecord = { record: any; needsCheck: boolean };
  const pending: PendingRecord[] = [];
  const checkedUrls = new Map<string, { status: string; suggestion: string | null }>();

  for (const item of allContent) {
    const pageUrl = item.link || `${siteUrl}/?p=${item.id}`;
    const html = item.content?.rendered || "";
    if (!html) continue;

    const links = extractLinks(html);

    for (const link of links) {
      if (!link.href || link.href.startsWith("#") || link.href.startsWith("mailto:") || link.href.startsWith("tel:")) {
        continue;
      }

      const isInternal = link.href.startsWith("/") || (siteUrl && link.href.includes(new URL(siteUrl).hostname));
      const record: any = {
        domain_id: domainId,
        page_url: pageUrl,
        link_href: link.href,
        anchor_text: link.text || null,
        link_type: isInternal ? "internal" : "external",
        company_id: companyId,
      };

      if (!link.text || link.text.trim() === "") {
        record.status = "missing_anchor";
        record.suggestion = "Add descriptive anchor text for SEO";
        pending.push({ record, needsCheck: false });
      } else {
        pending.push({ record, needsCheck: true });
      }
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
        pending.push({
          record: {
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
          },
          needsCheck: false,
        });
        rsicCount++;
      }
    }
  }

  console.log(`Collected ${pending.length} link records, checking status concurrently...`);

  // Deduplicate URLs to check
  const urlsToCheck = new Set<string>();
  for (const p of pending) {
    if (p.needsCheck && p.record.link_href) urlsToCheck.add(p.record.link_href);
  }

  // Check URLs in concurrent batches of 15
  const BATCH_SIZE = 15;
  const uniqueUrls = Array.from(urlsToCheck);
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
    const checks = await Promise.all(batch.map((url) => checkLink(url, siteUrl)));
    for (let j = 0; j < batch.length; j++) {
      const check = checks[j];
      if (check.error) {
        const suggestion = check.status ? `Link returns ${check.status}. Fix or remove.` : "Link unreachable or timed out";
        checkedUrls.set(batch[j], { status: "broken", suggestion });
      } else {
        checkedUrls.set(batch[j], { status: "ok", suggestion: null });
      }
    }
  }

  // Apply check results to records
  for (const p of pending) {
    if (p.needsCheck && p.record.link_href) {
      const result = checkedUrls.get(p.record.link_href);
      if (result) {
        p.record.status = result.status;
        p.record.suggestion = result.suggestion;
      } else {
        p.record.status = "ok";
      }
    }
    results.push(p.record);
  }

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

// ─── PREVIEW PHASE (AI-powered) ───

async function handlePreview(sb: any, auditIds: string[], _companyId: string) {
  const wp = new WPClient();
  const proposals: any[] = [];

  for (const id of auditIds) {
    const { data: record } = await sb.from("seo_link_audit").select("*").eq("id", id).single();
    if (!record || record.is_fixed) continue;

    try {
      const wpItem = await findWPItem(wp, record.page_url);
      if (!wpItem) {
        proposals.push({ id, error: "Could not find WordPress page/post" });
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

  return new Response(JSON.stringify({ success: true, proposals }), {
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

  const prompt = `You are an SEO expert fixing a broken link on a webpage.

Broken link: ${record.link_href}
Anchor text: ${record.anchor_text || "(no anchor text)"}
Broken link HTML: ${brokenLinkHtml}
Containing paragraph: ${containingParagraph}
${archiveUrl ? `Wayback Machine archive found: ${archiveUrl}` : "No Wayback Machine archive available."}

Decide the BEST action:
1. "remove" — Remove the <a> tag but keep the text content (if the link adds no value)
2. "archive" — Replace href with the Wayback Machine archive URL (only if archive exists)
3. "unlink" — Remove the entire link and its text (if it's spam or irrelevant)

Rules:
- Prefer "archive" if an archive URL exists and the link is valuable
- Prefer "remove" (keep text, drop link) if the text is useful but no archive exists
- Use "unlink" only for spam or completely irrelevant links

Return ONLY a JSON object:
- "action": "remove" | "archive" | "unlink"
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
      const wpItem = await findWPItem(wp, record.page_url);
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

async function findWPItem(wp: WPClient, pageUrl: string): Promise<any | null> {
  const url = new URL(pageUrl);
  const slug = url.pathname.replace(/^\/|\/$/g, "").split("/").pop() || "";
  if (!slug) return null;

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
