import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Candidate {
  id: string;
  mark_number: string | null;
  bar_code: string;
  cut_length_mm: number;
  total_pieces: number;
  asa_shape_code: string | null;
}

interface ExtractedTag {
  tag_number?: string;
  mark?: string;
  bar_size?: string;
  length_mm?: number;
  quantity?: number;
  shape_code?: string;
  raw_text?: string;
  confidence_ocr?: number;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
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

function norm(s: string | null | undefined): string {
  return (s || '').toString().trim().toUpperCase().replace(/\s+/g, '');
}

function scoreCandidate(c: Candidate, ocr: ExtractedTag): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const candMark = norm(c.mark_number);
  const ocrMark = norm(ocr.mark || ocr.tag_number);
  if (candMark && ocrMark) {
    if (candMark === ocrMark) { score += 0.45; reasons.push(`mark=${candMark}`); }
    else if (levenshtein(candMark, ocrMark) <= 1) { score += 0.25; reasons.push(`~mark=${candMark}≈${ocrMark}`); }
  }

  const candSize = norm(c.bar_code);
  const ocrSize = norm(ocr.bar_size);
  if (candSize && ocrSize && (candSize === ocrSize || candSize.includes(ocrSize) || ocrSize.includes(candSize))) {
    score += 0.15; reasons.push(`size=${candSize}`);
  }

  if (ocr.length_mm && c.cut_length_mm) {
    const diff = Math.abs(ocr.length_mm - c.cut_length_mm) / c.cut_length_mm;
    if (diff <= 0.02) { score += 0.20; reasons.push(`len±2%`); }
    else if (diff <= 0.05) { score += 0.10; reasons.push(`len±5%`); }
  }

  if (ocr.quantity && c.total_pieces && ocr.quantity === c.total_pieces) {
    score += 0.10; reasons.push(`qty=${c.total_pieces}`);
  }

  const candShape = norm(c.asa_shape_code);
  const ocrShape = norm(ocr.shape_code);
  if (candShape && ocrShape && candShape === ocrShape) {
    score += 0.10; reasons.push(`shape=${candShape}`);
  }

  return { score: Math.min(score, 1), reasons };
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
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an OCR assistant reading printed rebar tags. Extract structured fields exactly as they appear. Return numbers in mm. If a field is not visible, omit it.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read this rebar tag and extract its fields. Mark number is the primary identifier (e.g., "12B", "A03"). Bar size is like "15M", "20M", "#4". Length is the cut length in mm. Quantity is number of pieces. Shape code if shown.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_tag',
            description: 'Return the extracted tag fields.',
            parameters: {
              type: 'object',
              properties: {
                tag_number: { type: 'string' },
                mark: { type: 'string' },
                bar_size: { type: 'string' },
                length_mm: { type: 'number' },
                quantity: { type: 'number' },
                shape_code: { type: 'string' },
                raw_text: { type: 'string' },
                confidence_ocr: { type: 'number', description: '0..1 confidence in OCR quality' },
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

    const ranked = candidates
      .map((c) => ({ id: c.id, mark_number: c.mark_number, ...scoreCandidate(c, ocr) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    const second = ranked[1];
    let decision: 'auto' | 'confirm' | 'none' = 'none';
    if (best && best.score >= 0.85 && (!second || best.score - second.score >= 0.15)) {
      decision = 'auto';
    } else if (best && best.score >= 0.55) {
      decision = 'confirm';
    }

    return new Response(JSON.stringify({ ocr, ranked: ranked.slice(0, 5), decision }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('match-tag-photo error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
