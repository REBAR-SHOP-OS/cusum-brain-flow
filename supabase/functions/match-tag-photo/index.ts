import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Candidate {
  id: string;
  mark_number: string | null;
  bar_code: string;
  cut_length_mm: number;
  total_pieces: number;
  asa_shape_code: string | null;
  drawing_ref: string | null;
  ref_no: string | null;
  storage_zone?: string | null;
}

interface ExtractedTag {
  tag_number?: string;
  mark?: string;
  dwg?: string;
  ref?: string;
  bar_size?: string;
  length_text?: string;
  length_mm?: number;
  quantity?: number;
  grade?: string;
  shape_code?: string;
  raw_text?: string;
  confidence_ocr?: number;
}

// ----------------- normalization -----------------

function normMark(s: string | null | undefined): string {
  if (!s) return '';
  // Uppercase, strip everything that isn't a letter or digit,
  // then collapse common OCR confusions: I↔1, O↔0, S↔5, B↔8.
  // Mark numbers are alphanumeric IDs like A1501, 12B, A-1501.
  return s
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/I/g, '1')
    .replace(/O/g, '0');
}

function normSize(s: string | null | undefined): string {
  if (!s) return '';
  // Uppercase, drop spaces/dashes/dots. "15 M" / "15-M" / "#15" → "15M".
  return s.toString().toUpperCase().replace(/[\s\-_.#]/g, '');
}

function normGrade(s: string | null | undefined): string {
  if (!s) return '';
  return s.toString().toUpperCase().replace(/[\s\-_.]/g, '');
}

// DWG / Ref identifiers like "SD14", "SD-14", "S/14", "Ref 7". Strip everything
// non-alphanumeric, uppercase, collapse common OCR digit confusions.
function normCode(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/I/g, '1')
    .replace(/O/g, '0');
}

// Parse a length string in either imperial (14'2", 14-2, 14ft 2in) or metric (4318mm, 4.318m)
// and return millimetres. Returns null if unparseable.
function parseLengthToMm(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.toString().trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;

  // metric: 4318mm / 4.318m / 4318
  let m = s.match(/^(\d+(?:\.\d+)?)mm$/);
  if (m) return Math.round(parseFloat(m[1]));
  m = s.match(/^(\d+(?:\.\d+)?)m$/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);

  // imperial: 14'2", 14'2, 14-2, 14ft2in, 14ft, 14'
  m = s.match(/^(\d+)['ft]+(\d+)(?:["in]+)?$/);
  if (m) return Math.round((parseInt(m[1]) * 12 + parseInt(m[2])) * 25.4);
  m = s.match(/^(\d+)-(\d+)$/);
  if (m) return Math.round((parseInt(m[1]) * 12 + parseInt(m[2])) * 25.4);
  m = s.match(/^(\d+)['ft]+$/);
  if (m) return Math.round(parseInt(m[1]) * 12 * 25.4);

  // plain number — assume mm if > 100, else feet
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) {
    const n = parseFloat(m[1]);
    return n > 100 ? Math.round(n) : Math.round(n * 12 * 25.4);
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// ----------------- weighted scoring -----------------
// Weights — MARK + DWG + Ref are the three mandatory identifiers (combined ≈ 0.70).
// SIZE / LENGTH / QTY / SHAPE are tie-breakers only.
const W = { mark: 0.30, dwg: 0.20, ref: 0.20, size: 0.10, length: 0.12, qty: 0.04, shape: 0.04 };

function scoreCandidate(c: Candidate, ocr: ExtractedTag, ocrLenMm: number | null) {
  const reasons: string[] = [];
  const rejected: string[] = [];
  let score = 0;
  let markExact = false;
  let dwgExact = false;
  let refExact = false;
  let dwgMismatch = false;
  let refMismatch = false;

  const candMark = normMark(c.mark_number);
  const ocrMark = normMark(ocr.mark || ocr.tag_number);
  if (candMark && ocrMark) {
    if (candMark === ocrMark) {
      score += W.mark; reasons.push(`MARK=${candMark}`); markExact = true;
    } else {
      const d = levenshtein(candMark, ocrMark);
      if (d === 1) { score += W.mark * 0.6; reasons.push(`~MARK ${ocrMark}≈${candMark}`); }
      else if (d === 2 && candMark.length >= 4) { score += W.mark * 0.3; reasons.push(`~~MARK ${ocrMark}≈${candMark}`); }
      else rejected.push(`MARK ${ocrMark}≠${candMark}`);
    }
  }

  // ---- DWG (system: drawing_ref) ----
  const candDwg = normCode(c.drawing_ref);
  const ocrDwg = normCode(ocr.dwg);
  if (candDwg && ocrDwg) {
    if (candDwg === ocrDwg) {
      score += W.dwg; reasons.push(`DWG=${candDwg}`); dwgExact = true;
    } else {
      rejected.push(`DWG ${ocrDwg}≠${candDwg}`);
      dwgMismatch = true;
    }
  }

  // ---- Ref (system: ref_no) ----
  const candRef = normCode(c.ref_no);
  const ocrRef = normCode(ocr.ref);
  if (candRef && ocrRef) {
    if (candRef === ocrRef) {
      score += W.ref; reasons.push(`REF=${candRef}`); refExact = true;
    } else {
      rejected.push(`REF ${ocrRef}≠${candRef}`);
      refMismatch = true;
    }
  }

  const candSize = normSize(c.bar_code);
  const ocrSize = normSize(ocr.bar_size);
  if (candSize && ocrSize) {
    if (candSize === ocrSize || candSize.includes(ocrSize) || ocrSize.includes(candSize)) {
      score += W.size; reasons.push(`SIZE=${candSize}`);
    } else rejected.push(`SIZE ${ocrSize}≠${candSize}`);
  }

  if (ocrLenMm && c.cut_length_mm) {
    const diff = Math.abs(ocrLenMm - c.cut_length_mm) / c.cut_length_mm;
    if (diff <= 0.02) { score += W.length; reasons.push(`LEN±2%`); }
    else if (diff <= 0.05) { score += W.length * 0.6; reasons.push(`LEN±5%`); }
    else if (diff <= 0.10) { score += W.length * 0.3; reasons.push(`LEN±10%`); }
    else rejected.push(`LEN ${ocrLenMm}≠${c.cut_length_mm}mm`);
  }

  if (ocr.quantity && c.total_pieces) {
    if (ocr.quantity === c.total_pieces) { score += W.qty; reasons.push(`QTY=${c.total_pieces}`); }
    else rejected.push(`QTY ${ocr.quantity}≠${c.total_pieces}`);
  }

  const candShape = normSize(c.asa_shape_code);
  const ocrShape = normSize(ocr.shape_code);
  if (candShape && ocrShape && candShape === ocrShape) {
    score += W.shape; reasons.push(`SHAPE=${candShape}`);
  }

  return {
    score: Math.min(score, 1),
    reasons,
    rejected,
    markExact,
    dwgExact,
    refExact,
    dwgMismatch,
    refMismatch,
    matched_mark: c.mark_number ?? null,
    matched_dwg: c.drawing_ref ?? null,
    matched_ref: c.ref_no ?? null,
  };
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { imageBase64, candidates } = await req.json() as {
      imageBase64: string;
      candidates: Candidate[];
    };

    if (!imageBase64 || !Array.isArray(candidates)) {
      return new Response(JSON.stringify({ error: 'imageBase64 and candidates required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You read printed rebar fabrication tags. The tag is a printed grid with cells labeled MARK, SIZE, GRADE, QTY, LENGTH, DWG, REF. Read whatever you can — partial reads are fine. Always return raw_text containing every readable word on the tag, even if you cannot identify the fields. MARK, DWG and REF are critical identifiers; never skip them when visible.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract every field you can see on this rebar tag. Fields:\n- mark: the MARK cell content, e.g. "A1501", "12B", "A-1501"\n- dwg: the DWG / DRAWING cell content, e.g. "SD14", "S-14", "DWG-3"\n- ref: the REF / REFERENCE cell content (distinct from DWG), e.g. "R7", "REF-12"\n- bar_size: the SIZE cell, e.g. "15M", "20M", "#4"\n- grade: the GRADE cell, e.g. "400W", "60", "400"\n- quantity: integer in the QTY cell\n- length_text: LENGTH cell exactly as printed (keep imperial like 14\'2" or metric)\n- shape_code: shape designation if printed\n- raw_text: EVERY readable word on the tag (mandatory — never empty if any text is visible)\n- confidence_ocr: 0..1, your overall confidence the image contains a readable tag\n\nReturn partial data — never refuse just because some cells are unclear. MARK, DWG and REF are mandatory whenever readable.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_tag',
            description: 'Return the extracted tag fields. MARK, DWG and REF are mandatory whenever they are visible on the tag.',
            parameters: {
              type: 'object',
              properties: {
                tag_number: { type: 'string' },
                mark: { type: 'string' },
                dwg: { type: 'string' },
                ref: { type: 'string' },
                bar_size: { type: 'string' },
                grade: { type: 'string' },
                length_text: { type: 'string' },
                length_mm: { type: 'number' },
                quantity: { type: 'number' },
                shape_code: { type: 'string' },
                raw_text: { type: 'string' },
                confidence_ocr: { type: 'number' },
              },
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_tag' } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error('AI gateway error', aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please retry shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Settings > Workspace > Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    let ocr: ExtractedTag = {};
    try {
      ocr = JSON.parse(toolCall?.function?.arguments || '{}');
    } catch (e) {
      console.error('Failed to parse tool args', e);
    }

    // Normalize length to mm if not provided directly.
    const ocrLenMm = (typeof ocr.length_mm === 'number' && ocr.length_mm > 0)
      ? ocr.length_mm
      : parseLengthToMm(ocr.length_text);

    const normalized = {
      mark: normMark(ocr.mark || ocr.tag_number),
      dwg: normCode(ocr.dwg),
      ref: normCode(ocr.ref),
      size: normSize(ocr.bar_size),
      grade: normGrade(ocr.grade),
      length_mm: ocrLenMm,
      quantity: ocr.quantity ?? null,
      shape: normSize(ocr.shape_code),
    };

    // Count meaningful fields. Even raw_text alone is meaningful — we'd rather
    // pick from a list than tell the operator "unreadable".
    const fieldHits =
      (normalized.mark ? 1 : 0) +
      (normalized.dwg ? 1 : 0) +
      (normalized.ref ? 1 : 0) +
      (normalized.size ? 1 : 0) +
      (normalized.length_mm ? 1 : 0) +
      (normalized.quantity ? 1 : 0) +
      (normalized.grade ? 1 : 0);
    const rawHasText = !!(ocr.raw_text && ocr.raw_text.replace(/[^A-Z0-9]/gi, '').length >= 4);

    const scored = candidates.map((c) => ({
      id: c.id,
      mark_number: c.mark_number,
      ...scoreCandidate(c, ocr, ocrLenMm),
    }));
    const ranked = [...scored].sort((a, b) => b.score - a.score);

    // ---- decision ----
    // STRICT 3-FIELD RULE: auto-match requires MARK + DWG + Ref all to match
    // exactly on the SAME candidate. Anything else degrades to 'confirm' or 'none'.
    let decision: 'auto' | 'confirm' | 'none' = 'none';
    let reason = '';
    let mismatchReason: string | null = null;

    const strictHits = scored.filter((s) => s.markExact && s.dwgExact && s.refExact);
    const exactMarkHits = scored.filter((s) => s.markExact);

    if (strictHits.length === 1) {
      decision = 'auto';
      reason = 'unique MARK+DWG+Ref exact';
    } else if (strictHits.length > 1) {
      // Should never happen with proper data — multiple identical 3-tuples.
      decision = 'confirm';
      reason = 'multiple MARK+DWG+Ref matches';
      mismatchReason = 'Duplicate MARK+DWG+Ref in manifest — supervisor review.';
    } else if (exactMarkHits.length >= 1) {
      // MARK matched but DWG or Ref is missing/mismatched. Never auto-clear.
      decision = 'confirm';
      const m = exactMarkHits[0];
      const parts: string[] = [];
      if (!normalized.dwg) parts.push('DWG missing on tag');
      else if (m.dwgMismatch) parts.push(`DWG ${normalized.dwg}≠${normCode(m.matched_dwg)}`);
      else if (!normCode(m.matched_dwg)) parts.push('DWG missing on item');
      if (!normalized.ref) parts.push('Ref missing on tag');
      else if (m.refMismatch) parts.push(`Ref ${normalized.ref}≠${normCode(m.matched_ref)}`);
      else if (!normCode(m.matched_ref)) parts.push('Ref missing on item');
      mismatchReason = `MARK matched, but ${parts.join(' · ') || 'DWG/Ref incomplete'}.`;
      reason = mismatchReason;
    } else {
      const best = ranked[0];
      if (best && best.score >= 0.25) {
        decision = 'confirm'; reason = `medium score ${best.score.toFixed(2)}`;
      } else if (fieldHits === 0 && !rawHasText) {
        decision = 'none'; reason = 'no readable text';
      } else if (candidates.length <= 5) {
        decision = 'confirm'; reason = 'low score but text present';
      } else {
        decision = 'none'; reason = 'low score, large manifest';
      }
    }

    const debug = {
      raw_ocr: ocr,
      normalized,
      field_hits: fieldHits,
      raw_has_text: rawHasText,
      ranked_top5: ranked.slice(0, 5),
      strict_hits: strictHits.length,
      decision,
      reason,
      mismatch_reason: mismatchReason,
    };
    console.log('match-tag-photo', JSON.stringify(debug));

    return new Response(JSON.stringify({
      ocr,
      normalized,
      ranked: ranked.slice(0, 5),
      decision,
      reason,
      mismatch_reason: mismatchReason,
      debug,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('match-tag-photo error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
