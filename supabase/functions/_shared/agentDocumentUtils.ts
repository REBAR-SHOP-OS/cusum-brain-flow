
import { callAI, type AIMessage, type AIProvider } from "./aiRouter.ts";

interface ValidationRule {
  rule_name: string;
  rule_type: string;
  element_type: string | null;
  min_value: number | null;
  max_value: number | null;
  unit: string;
  error_message: string;
  warning_message: string | null;
  severity: string;
}

interface ExtractedRebarData {
  mark: string;
  diameter: number;
  quantity: number;
  length: number;
  shape?: string;
  spacing?: number;
  element?: string;
  warnings: string[];
}

interface DetectedZone {
  type: 'schedule' | 'notes' | 'drawing' | 'detail' | 'title_block';
  content: string;
  confidence: number;
}

const extractionPrompt = `You are a Senior Structural Estimator Engineer analyzing construction drawings.
TASK: Extract ALL text, dimensions, schedules, notes, and specifications from this document with 100% accuracy.
FOCUS ON: Foundation/Pier/Column/Beam/Slab Schedules, General Notes, Scale, Dimensions.
OUTPUT FORMAT: Use EXACT notation (e.g., "7-20M B.E.W."), preserve tables.`;

async function fetchFileAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.slice(i, i + 8192));
    }
    return { base64: btoa(binary), mimeType: contentType };
  } catch (error) {
    console.error("Error fetching file:", error);
    return null;
  }
}

export async function analyzeDocumentWithGemini(
  fileUrl: string, 
  fileName: string,
  prompt: string
): Promise<{ text: string; error?: string }> {
  try {
    const fileData = await fetchFileAsBase64(fileUrl);
    if (!fileData) return { text: "", error: "Failed to fetch file" };

    try {
      const result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${fileData.mimeType};base64,${fileData.base64}` },
              },
            ],
          } as any,
        ],
        maxTokens: 8000,
        temperature: 0.1,
      });
      return { text: result.content };
    } catch (err) {
      return { text: "", error: `Gemini Vision failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  } catch (error) {
    return { text: "", error: error instanceof Error ? error.message : "Analysis failed" };
  }
}

export async function performOCR(imageUrl: string): Promise<{ fullText: string; textBlocks: Array<{ text: string; boundingPoly: unknown }>; error?: string }> {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-vision-ocr`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ imageUrl }),
      }
    );

    if (!response.ok) {
      return { fullText: "", textBlocks: [], error: `OCR failed: ${response.status}` };
    }

    const data = await response.json();
    return { fullText: data.fullText || "", textBlocks: data.textBlocks || [] };
  } catch (error) {
    return { fullText: "", textBlocks: [], error: error instanceof Error ? error.message : "OCR failed" };
  }
}

export async function convertPdfToImages(pdfUrl: string, maxPages: number = 20): Promise<{ 
  pages: string[]; 
  pageCount: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/pdf-to-images`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ pdfUrl, maxPages, dpi: 200 }),
      }
    );

    if (!response.ok) return { pages: [], pageCount: 0, error: `PDF conversion failed: ${response.status}` };
    const data = await response.json();
    if (!data.success) return { pages: [], pageCount: 0, error: data.error || "PDF conversion failed" };
    return { pages: data.pages || [], pageCount: data.pageCount || 0 };
  } catch (error) {
    return { pages: [], pageCount: 0, error: error instanceof Error ? error.message : "PDF conversion failed" };
  }
}

export async function performOCROnBase64(base64Image: string): Promise<{ 
  fullText: string; 
  textBlocks: Array<{ text: string; boundingPoly: unknown }>;
  error?: string;
}> {
  try {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-vision-ocr`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ imageBase64: base64Data }),
      }
    );

    if (!response.ok) return { fullText: "", textBlocks: [], error: `OCR failed: ${response.status}` };
    const data = await response.json();
    return { fullText: data.fullText || "", textBlocks: data.textBlocks || [] };
  } catch (error) {
    return { fullText: "", textBlocks: [], error: error instanceof Error ? error.message : "OCR failed" };
  }
}

export function detectZones(fullText: string, textBlocks: Array<{ text: string; boundingPoly: unknown }>): DetectedZone[] {
  const zones: DetectedZone[] = [];
  const schedulePatterns = [/(?:FOUNDATION|FOOTING|PIER|COLUMN|BEAM|SLAB)\s*SCHEDULE/i, /SCHEDULE\s*(?:OF|FOR)\s*(?:REINFORCEMENT|REBAR|BARS)/i, /REBAR\s*SCHEDULE/i];
  
  let scheduleContent = "";
  for (const pattern of schedulePatterns) {
    if (pattern.test(fullText)) {
      const match = fullText.match(new RegExp(`${pattern.source}[\\s\\S]{0,2000}`, 'i'));
      if (match) scheduleContent += match[0] + "\n";
    }
  }
  if (scheduleContent) zones.push({ type: 'schedule', content: scheduleContent, confidence: 90 });
  
  if (zones.length === 0) zones.push({ type: 'drawing', content: fullText, confidence: 70 });
  return zones;
}

export function extractRebarData(text: string, validationRules: ValidationRule[]): ExtractedRebarData[] {
  const rebarData: ExtractedRebarData[] = [];
  const patterns = [/(\d+)\s*[-x×]\s*(\d+)M\s*(?:@\s*(\d+))?/gi]; // CSA
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const quantity = parseInt(match[1]) || 0;
      const diameter = parseInt(match[2]) || 0;
      const spacing = parseInt(match[3]) || 0;
      const warnings: string[] = [];
      
      if (diameter > 0) {
        for (const rule of validationRules) {
          if (rule.rule_type === 'dimension' && rule.min_value && diameter < rule.min_value) warnings.push(`⚠️ ${rule.warning_message}`);
        }
        rebarData.push({ mark: `R${rebarData.length + 1}`, diameter, quantity, length: 0, spacing: spacing || undefined, warnings });
      }
    }
  }
  return rebarData;
}

export async function performMultiPassAnalysis(
  fileUrl: string, 
  fileName: string,
  isPdf: boolean,
  validationRules: ValidationRule[]
): Promise<{ 
  mergedText: string; 
  confidence: number; 
  discrepancies: string[]; 
  zones: DetectedZone[];
  extractedRebar: ExtractedRebarData[];
}> {
  const discrepancies: string[] = [];
  let allZones: DetectedZone[] = [];
  let allExtractedRebar: ExtractedRebarData[] = [];

  if (isPdf) {
    const conversionResult = await convertPdfToImages(fileUrl, 20);
    
    if (conversionResult.error || conversionResult.pages.length === 0) {
      const result = await analyzeDocumentWithGemini(fileUrl, fileName, extractionPrompt);
      const zones = detectZones(result.text, []);
      const extractedRebar = extractRebarData(result.text, validationRules);
      return { mergedText: result.text, confidence: 60, discrepancies: ["Used Gemini Fallback"], zones, extractedRebar };
    }
    
    const pageResults: string[] = [];
    for (let i = 0; i < conversionResult.pages.length; i++) {
      const ocrResult = await performOCROnBase64(conversionResult.pages[i]);
      if (ocrResult.fullText) {
        const pageZones = detectZones(ocrResult.fullText, ocrResult.textBlocks);
        allZones.push(...pageZones);
        const pageRebar = extractRebarData(ocrResult.fullText, validationRules);
        allExtractedRebar.push(...pageRebar);
        pageResults.push(ocrResult.fullText);
      }
    }
    return { mergedText: pageResults.join("\n"), confidence: 90, discrepancies, zones: allZones, extractedRebar: allExtractedRebar };
  }
  
  const ocrResult = await performOCR(fileUrl);
  const zones = detectZones(ocrResult.fullText, ocrResult.textBlocks);
  const extractedRebar = extractRebarData(ocrResult.fullText, validationRules);
  
  return { mergedText: ocrResult.fullText, confidence: 80, discrepancies, zones, extractedRebar };
}
