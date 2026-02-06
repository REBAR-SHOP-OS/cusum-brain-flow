import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AgentRequest {
  agent: "sales" | "accounting" | "support" | "collections" | "estimation";
  message: string;
  history?: ChatMessage[];
  context?: Record<string, unknown>;
  attachedFiles?: { name: string; url: string }[];
}

interface RebarStandard {
  bar_size: string;
  bar_size_mm: number;
  weight_per_meter: number;
  area_mm2: number;
  standard_code: string;
  grade: string;
  lap_tension_mult: number;
  lap_compression_mult: number;
}

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

// Fetch file as base64 for Gemini Vision
async function fetchFileAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch file: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    return { base64, mimeType: contentType };
  } catch (error) {
    console.error("Error fetching file:", error);
    return null;
  }
}

// Analyze document using Gemini Vision (supports PDF and images)
async function analyzeDocumentWithGemini(
  fileUrl: string, 
  fileName: string,
  prompt: string
): Promise<{ text: string; error?: string }> {
  try {
    const fileData = await fetchFileAsBase64(fileUrl);
    if (!fileData) {
      return { text: "", error: "Failed to fetch file" };
    }

    console.log(`Analyzing ${fileName} with Gemini Vision (${fileData.mimeType})...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
          },
        ],
        max_tokens: 8000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini Vision error:", errorText);
      return { text: "", error: `Gemini Vision failed: ${response.status}` };
    }

    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || "" };
  } catch (error) {
    console.error("Document analysis error:", error);
    return { text: "", error: error instanceof Error ? error.message : "Analysis failed" };
  }
}

// OCR function for estimation agent (using Google Vision for images)
async function performOCR(imageUrl: string): Promise<{ fullText: string; textBlocks: Array<{ text: string; boundingPoly: unknown }>; error?: string }> {
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
      const errorText = await response.text();
      console.error("OCR error:", errorText);
      return { fullText: "", textBlocks: [], error: `OCR failed: ${response.status}` };
    }

    const data = await response.json();
    return { fullText: data.fullText || "", textBlocks: data.textBlocks || [] };
  } catch (error) {
    console.error("OCR error:", error);
    return { fullText: "", textBlocks: [], error: error instanceof Error ? error.message : "OCR failed" };
  }
}

// Convert PDF to images using the pdf-to-images edge function
async function convertPdfToImages(pdfUrl: string, maxPages: number = 20): Promise<{ 
  pages: string[]; 
  pageCount: number;
  error?: string;
}> {
  try {
    console.log(`Converting PDF to images: ${pdfUrl}`);
    
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PDF conversion error:", errorText);
      return { pages: [], pageCount: 0, error: `PDF conversion failed: ${response.status}` };
    }

    const data = await response.json();
    
    if (!data.success) {
      return { pages: [], pageCount: 0, error: data.error || "PDF conversion failed" };
    }
    
    console.log(`PDF converted: ${data.processedPages} pages`);
    return { pages: data.pages || [], pageCount: data.pageCount || 0 };
  } catch (error) {
    console.error("PDF conversion error:", error);
    return { pages: [], pageCount: 0, error: error instanceof Error ? error.message : "PDF conversion failed" };
  }
}

// Perform OCR on base64 image data with zone detection
async function performOCROnBase64(base64Image: string): Promise<{ 
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OCR error:", errorText);
      return { fullText: "", textBlocks: [], error: `OCR failed: ${response.status}` };
    }

    const data = await response.json();
    return { fullText: data.fullText || "", textBlocks: data.textBlocks || [] };
  } catch (error) {
    console.error("OCR error:", error);
    return { fullText: "", textBlocks: [], error: error instanceof Error ? error.message : "OCR failed" };
  }
}

// Zone detection for structural drawings
interface DetectedZone {
  type: 'schedule' | 'notes' | 'drawing' | 'detail' | 'title_block';
  content: string;
  confidence: number;
}

function detectZones(fullText: string, textBlocks: Array<{ text: string; boundingPoly: unknown }>): DetectedZone[] {
  const zones: DetectedZone[] = [];
  
  // Schedule detection patterns
  const schedulePatterns = [
    /(?:FOUNDATION|FOOTING|PIER|COLUMN|BEAM|SLAB)\s*SCHEDULE/i,
    /SCHEDULE\s*(?:OF|FOR)\s*(?:REINFORCEMENT|REBAR|BARS)/i,
    /REBAR\s*SCHEDULE/i,
    /REINFORCEMENT\s*SCHEDULE/i,
    /جدول\s*(?:آرماتور|میلگرد)/,
    /MARK\s*(?:SIZE|QTY|LENGTH)/i,
  ];
  
  // Notes section patterns
  const notesPatterns = [
    /GENERAL\s*NOTES?/i,
    /STRUCTURAL\s*NOTES?/i,
    /REINFORCEMENT\s*NOTES?/i,
    /یادداشت(?:‌ها)?/,
    /ملاحظات/,
    /NOTE:?\s*\d/i,
  ];
  
  // Title block patterns
  const titleBlockPatterns = [
    /PROJECT\s*(?:NAME|TITLE)/i,
    /SHEET\s*(?:NO|NUMBER)/i,
    /SCALE\s*:/i,
    /DATE\s*:/i,
    /DRAWN\s*BY/i,
    /CHECKED\s*BY/i,
  ];
  
  // Detail patterns
  const detailPatterns = [
    /DETAIL\s*(?:[A-Z]|\d)/i,
    /SECTION\s*(?:[A-Z]|\d)/i,
    /TYPICAL\s*(?:DETAIL|SECTION)/i,
    /جزئیات/,
    /مقطع/,
  ];
  
  // Check for schedule content
  let scheduleContent = "";
  for (const pattern of schedulePatterns) {
    if (pattern.test(fullText)) {
      // Extract table-like content after schedule header
      const match = fullText.match(new RegExp(`${pattern.source}[\\s\\S]{0,2000}`, 'i'));
      if (match) {
        scheduleContent += match[0] + "\n";
      }
    }
  }
  if (scheduleContent) {
    zones.push({ type: 'schedule', content: scheduleContent, confidence: 90 });
  }
  
  // Check for notes
  let notesContent = "";
  for (const pattern of notesPatterns) {
    if (pattern.test(fullText)) {
      const match = fullText.match(new RegExp(`${pattern.source}[\\s\\S]{0,1500}`, 'i'));
      if (match) {
        notesContent += match[0] + "\n";
      }
    }
  }
  if (notesContent) {
    zones.push({ type: 'notes', content: notesContent, confidence: 85 });
  }
  
  // Check for title block
  let titleContent = "";
  for (const pattern of titleBlockPatterns) {
    if (pattern.test(fullText)) {
      const match = fullText.match(new RegExp(`${pattern.source}[^\\n]{0,100}`, 'i'));
      if (match) {
        titleContent += match[0] + "\n";
      }
    }
  }
  if (titleContent) {
    zones.push({ type: 'title_block', content: titleContent, confidence: 95 });
  }
  
  // Check for details
  let detailContent = "";
  for (const pattern of detailPatterns) {
    if (pattern.test(fullText)) {
      const match = fullText.match(new RegExp(`${pattern.source}[\\s\\S]{0,800}`, 'i'));
      if (match) {
        detailContent += match[0] + "\n";
      }
    }
  }
  if (detailContent) {
    zones.push({ type: 'detail', content: detailContent, confidence: 80 });
  }
  
  // Remaining content is drawing area
  if (zones.length === 0) {
    zones.push({ type: 'drawing', content: fullText, confidence: 70 });
  }
  
  return zones;
}

// Parse and validate extracted rebar data
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

function extractRebarData(text: string, validationRules: ValidationRule[]): ExtractedRebarData[] {
  const rebarData: ExtractedRebarData[] = [];
  
  // Common rebar patterns
  const patterns = [
    // CSA format: "7-20M @ 300 B.E.W."
    /(\d+)\s*[-x×]\s*(\d+)M\s*(?:@\s*(\d+))?/gi,
    // Iranian format: "Ø16@200"
    /Ø(\d+)\s*(?:@\s*(\d+))?/gi,
    // ACI format: "#5 @ 12" O.C."
    /#(\d+)\s*(?:@\s*(\d+))?/gi,
    // Generic: "10 pcs Ø20 L=3000"
    /(\d+)\s*(?:pcs|عدد|pc)?\s*(?:Ø|φ|ø)(\d+)\s*(?:L\s*[=:]\s*(\d+))?/gi,
    // Table format: diameter in column, qty in another
    /(\d+)\s+(\d+)\s+(\d+)/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const warnings: string[] = [];
      let diameter = 0;
      let quantity = 0;
      let length = 0;
      let spacing = 0;
      
      // Parse based on pattern type
      if (pattern.source.includes('M')) {
        // CSA format
        quantity = parseInt(match[1]) || 0;
        diameter = parseInt(match[2]) || 0;
        spacing = parseInt(match[3]) || 0;
      } else if (pattern.source.includes('Ø')) {
        // Iranian/metric format
        diameter = parseInt(match[1]) || 0;
        spacing = parseInt(match[2]) || 0;
      } else if (pattern.source.includes('#')) {
        // ACI format - convert bar number to mm
        const barNum = parseInt(match[1]);
        diameter = Math.round(barNum * 3.175); // Approximate conversion
        spacing = parseInt(match[2]) || 0;
      }
      
      if (diameter > 0) {
        // Validate against rules
        for (const rule of validationRules) {
          if (rule.rule_type === 'dimension' && rule.element_type === null) {
            if (rule.min_value && diameter < rule.min_value) {
              warnings.push(`⚠️ ${rule.warning_message || rule.error_message}`);
            }
            if (rule.max_value && diameter > rule.max_value) {
              warnings.push(`❌ ${rule.error_message}`);
            }
          }
          if (rule.rule_type === 'spacing' && spacing > 0) {
            if (rule.min_value && spacing < rule.min_value) {
              warnings.push(`❌ ${rule.error_message}`);
            }
          }
        }
        
        rebarData.push({
          mark: `R${rebarData.length + 1}`,
          diameter,
          quantity,
          length,
          spacing: spacing || undefined,
          warnings,
        });
      }
    }
  }
  
  return rebarData;
}

const extractionPrompt = `You are a Senior Structural Estimator Engineer analyzing construction drawings.

TASK: Extract ALL text, dimensions, schedules, notes, and specifications from this document with 100% accuracy.

FOCUS ON:
1. Foundation Schedules (F1, F2, F3, etc.) - sizes, rebar specs (e.g., 7-20M B.E.W.)
2. Pier Schedules (P1, P2, etc.) - sizes, vertical bars, ties
3. Column Schedules - steel sizes, base plates, anchor bolts
4. Beam Schedules - dimensions, reinforcement
5. Slab details - thickness, mesh type, spacing
6. General Notes - concrete strength, rebar grade, cover requirements
7. Scale information (e.g., 1/4"=1'-0", 3/4"=1'-0")
8. Dimensions - ALL dimensions visible on drawings
9. Section references (A/S1, B/S2, etc.)

OUTPUT FORMAT:
- Use EXACT notation from drawings (e.g., "7-20M B.E.W." not "seven 20mm bars")
- Preserve table structures
- Mark unclear items with "!" suffix
- Group by element type (Foundations, Piers, Columns, Beams, Slabs, Notes)

Be EXTREMELY thorough - missing data causes estimation errors.`;

// Zone-aware extraction prompt
const zoneExtractionPrompt = `You are analyzing a structural drawing with zone detection enabled.

DETECTED ZONES IN THIS IMAGE:
{zones}

For each zone, extract relevant data:

**SCHEDULE ZONES:**
- Extract all rows from rebar schedules
- Capture: Mark, Size, Qty, Length, Shape, Notes
- Preserve exact notation (e.g., "7-20M", "#5", "Ø16")

**NOTES ZONES:**
- Extract concrete strength (f'c)
- Rebar grade and coating
- Cover requirements
- Lap splice requirements
- Special instructions

**DETAIL ZONES:**
- Dimension callouts
- Reinforcement details
- Typical sections

**TITLE BLOCK:**
- Project name
- Drawing number
- Scale
- Date

Format output as structured data for calculation.`;

// Multi-pass document analysis with zone detection and validation
async function performMultiPassAnalysis(
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
    console.log(`Processing PDF with Google Vision OCR: ${fileName}`);
    
    const conversionResult = await convertPdfToImages(fileUrl, 20);
    
    if (conversionResult.error || conversionResult.pages.length === 0) {
      console.log(`PDF conversion failed, falling back to Gemini Vision: ${conversionResult.error}`);
      const result = await analyzeDocumentWithGemini(fileUrl, fileName, extractionPrompt);
      
      if (result.error) {
        discrepancies.push(`PDF analysis warning: ${result.error}`);
      }
      
      const zones = detectZones(result.text, []);
      const extractedRebar = extractRebarData(result.text, validationRules);
      
      return {
        mergedText: result.text,
        confidence: result.text.length > 500 ? 75 : 40,
        discrepancies: [...discrepancies, "Used Gemini Vision fallback (PDF conversion unavailable)"],
        zones,
        extractedRebar,
      };
    }
    
    const pageResults: string[] = [];
    let successfulPages = 0;
    
    for (let i = 0; i < conversionResult.pages.length; i++) {
      console.log(`Running OCR on page ${i + 1}/${conversionResult.pages.length}`);
      const ocrResult = await performOCROnBase64(conversionResult.pages[i]);
      
      if (ocrResult.fullText && ocrResult.fullText.length > 20) {
        // Detect zones for this page
        const pageZones = detectZones(ocrResult.fullText, ocrResult.textBlocks);
        allZones = [...allZones, ...pageZones.map(z => ({ ...z, content: `[Page ${i + 1}] ${z.content}` }))];
        
        // Extract rebar data
        const pageRebar = extractRebarData(ocrResult.fullText, validationRules);
        allExtractedRebar = [...allExtractedRebar, ...pageRebar];
        
        pageResults.push(`\n=== PAGE ${i + 1} ===\n${ocrResult.fullText}`);
        successfulPages++;
      } else if (ocrResult.error) {
        discrepancies.push(`Page ${i + 1} OCR warning: ${ocrResult.error}`);
      }
    }
    
    const mergedText = pageResults.join("\n");
    const confidence = successfulPages > 0 ? 
      Math.min(95, 60 + (successfulPages / conversionResult.pages.length) * 35) : 30;
    
    // Add validation warnings to discrepancies
    for (const rebar of allExtractedRebar) {
      discrepancies.push(...rebar.warnings);
    }
    
    console.log(`PDF OCR complete: ${successfulPages}/${conversionResult.pages.length} pages, ${allZones.length} zones detected`);
    
    return {
      mergedText,
      confidence,
      discrepancies,
      zones: allZones,
      extractedRebar: allExtractedRebar,
    };
  }
  
  // For images
  console.log(`Analyzing image: ${fileName}`);
  const ocrResult = await performOCR(fileUrl);
  
  if (ocrResult.fullText && ocrResult.fullText.length > 100) {
    const zones = detectZones(ocrResult.fullText, ocrResult.textBlocks);
    const extractedRebar = extractRebarData(ocrResult.fullText, validationRules);
    
    return {
      mergedText: ocrResult.fullText,
      confidence: 80,
      discrepancies: extractedRebar.flatMap(r => r.warnings),
      zones,
      extractedRebar,
    };
  }
  
  // Fallback to Gemini Vision
  console.log(`Falling back to Gemini Vision for: ${fileName}`);
  const geminiResult = await analyzeDocumentWithGemini(fileUrl, fileName, extractionPrompt);
  
  if (geminiResult.error) {
    discrepancies.push(`Image analysis warning: ${geminiResult.error}`);
  }
  
  const zones = detectZones(geminiResult.text || ocrResult.fullText, []);
  const extractedRebar = extractRebarData(geminiResult.text || ocrResult.fullText, validationRules);
  
  return {
    mergedText: geminiResult.text || ocrResult.fullText,
    confidence: geminiResult.text ? 75 : 50,
    discrepancies: [...discrepancies, ...extractedRebar.flatMap(r => r.warnings)],
    zones,
    extractedRebar,
  };
}

// Agent system prompts
const agentPrompts: Record<string, string> = {
  sales: `You are the Sales Agent for REBAR SHOP OS, a rebar shop operations system.
You help with quotes, follow-ups, and customer relationships.
You can query customers, quotes, orders, and communications.
Always draft actions for human approval - never send emails or approve quotes directly.
Be concise and action-oriented.`,

  accounting: `You are the Accounting Agent for REBAR SHOP OS.
You help track AR/AP, QuickBooks sync status, and payment issues.
You can query the accounting_mirror table and customer balances.
Flag discrepancies and draft collection notices for approval.
Be precise with numbers.`,

  support: `You are the Support Agent for REBAR SHOP OS.
You help resolve customer issues, track delivery problems, and draft responses.
You can query orders, deliveries, communications, and tasks.
Always draft responses for human approval before sending.
Be empathetic but efficient.`,

  collections: `You are the Collections Agent for REBAR SHOP OS.
You help with AR aging, payment reminders, and credit holds.
You can query accounting_mirror, customers, and communications.
Prioritize overdue accounts and draft follow-up sequences.
Be firm but professional.`,

  estimation: `# System Instruction: Senior Structural Estimator Engineer (Changy Method)
# Reference: RSIC Manual of Standard Practice - Fifth Canadian Edition 2018

## Role & Persona
You are **Cal**, a world-class Senior Structural Estimator Engineer certified by the Reinforcing Steel Institute of Canada (RSIC). Your expertise lies in high-precision rebar (steel reinforcement) and WWF (Welded Wire Fabric) takeoff according to CSA G30.18 standards. You operate with an engineering mindset: meticulous, logical, and extremely detail-oriented.

**CRITICAL: You ONLY use CSA/Canadian standards. No ACI, no Iranian, no other standards.**

---

## 📖 PRIMARY REFERENCE: RSIC 2018 Manual

### Chapter 4 - Standard Practice - Estimating
Key rules from RSIC 2018:

**BAR LENGTH (RSIC 4.1)**
- Footings: Bottom bars extend to 75mm from edge of footing unless noted otherwise
- Construction Joints: Bars extend 150mm past CJ to allow lap splice
- Column Verticals: Extend from top of footing to 150mm below top of slab
- Column Ties: Based on column dimensions minus cover on all sides

**SPLICES (RSIC 4.9)**
- Class B tension laps for horizontal/vertical bars in walls, slabs, beams
- Compression and embedment lengths for column dowels
- Compression splices for all other vertical bars
- Lap splices of 45M and 55M are NOT allowed - use mechanical or welded splices

**HOOKS (RSIC 4.6)**
- If hook type not specified, assume 90° hook
- Estimate length equal to dimensions A or G from Table 5

**SPIRALS (RSIC 4.8)**
- Diameter = Column outside diameter - 80mm
- Height = Top of footing to lowest horizontal reinforcement in slab/beam above

**WWF - Welded Wire Fabric (RSIC Chapter 11)**
- Laps: Minimum one full mesh space plus 50mm
- Support Accessories spacing per RSIC recommendations

---

## 🧠 LEARNING SYSTEM & STANDARDS DATABASE
You have access to:
1. **Rebar Standards Database** - CSA G30.18-400W weights from RSIC Table 1A
2. **WWF Standards Database** - Sheet sizes, weights, overlap requirements per RSIC Chapter 11
3. **Validation Rules** - Automatic checking per RSIC tolerances
4. **Learning Database** - Patterns from previous Canadian projects

When you receive "rebarStandards" in context:
- Use EXACT weights from database per CSA G30.18
- Apply lap lengths based on CSA A23.3 (referenced in RSIC)
- Reference proper hook dimensions from RSIC Table 5

---

## Zone Detection System
Your OCR analysis now includes **zone detection**:
- **SCHEDULE zones**: Rebar schedules, bar lists (RSIC format)
- **NOTES zones**: General notes, f'c, grade specifications
- **DETAIL zones**: Section details, typical details
- **TITLE BLOCK**: Project info, scale, dates

---

## The Methodology: "The Changy Method"
You must strictly follow the **"Changy Method"** for all estimations per RSIC guidelines.

### Step Definitions:

| Step | Name | Description |
|------|------|-------------|
| **Step 1** | Scope ID (3+3 Scan) | Identify all structural elements per RSIC Chapter 1 |
| **Step 2** | Classification | Categorize elements into **New** or **Existing** |
| **Step 2.5** | Rebar Type | Grade 400W or 400R per CSA G30.18 |
| **Step 3** | Measurement/Scale | Calculate scales per RSIC Chapter 5 |
| **Step 4** | Dimensions/Verification | Verify per RSIC tolerances Chapter 6 |
| **Step 5** | Quantity/Spacing | Calculate per RSIC Chapter 4 estimating rules |
| **Step 5.5** | Optimization/Overlap | Stock lengths, laps per RSIC Chapter 10 |
| **Step 6** | Weight Calculation | **USING RSIC TABLE 1A VALUES** |
| **Step 7** | Final Summary | Consolidate in TONNES |
| **Step 8** | WWF Takeoff | Per RSIC Chapter 11 |

---

## The 3+3 Scanning Protocol (OCR Policy)

When images or PDFs are provided, perform 6 scans total:
1. **Pass 1**: 3 independent internal scans
2. **Pass 2**: 3 independent internal scans

**Goal**: Zero Data Loss per RSIC accuracy requirements

---

## Core Rules

### 1. The Uncertainty Rule ⚠️
If any value is unclear, append **"!"** - mandatory safety protocol.

### 2. User Corrections & Learning
- User corrections take precedence over OCR
- State: "I've learned: [correction] - I'll apply this to similar projects"

### 3. Smart Calculation Mode
For **"Smart Estimate"** or **"Full Auto-Takeoff"**:
- Perform ALL 8 steps automatically
- Apply RSIC standards throughout
- Present **[FINAL_RESULT]** in **TONNES**

### 4. Step-by-Step Mode
- Execute ONE step at a time
- Reference specific RSIC sections
- Ask for approval before proceeding

---

## CSA G30.18 Rebar Reference (RSIC Table 1A)

| Size | Nominal Diameter (mm) | Area (mm²) | Mass (kg/m) |
|------|-----------------------|------------|-------------|
| 10M | 11.3 | 100 | 0.785 |
| 15M | 16.0 | 200 | 1.570 |
| 20M | 19.5 | 300 | 2.355 |
| 25M | 25.2 | 500 | 3.925 |
| 30M | 29.9 | 700 | 5.495 |
| 35M | 35.7 | 1000 | 7.850 |
| 45M | 43.7 | 1500 | 11.775 |
| 55M | 56.4 | 2500 | 19.625 |

**Grade**: 400W (Weldable) or 400R (Regular)

---

## Standard Hook Dimensions (RSIC Table 5)

| Size | 90° Hook "A" (mm) | 180° Hook "G" (mm) | Min Bend Radius |
|------|-------------------|--------------------| ----------------|
| 10M | 200 | 130 | 30mm (3db) |
| 15M | 250 | 160 | 45mm (3db) |
| 20M | 300 | 200 | 60mm (3db) |
| 25M | 400 | 250 | 125mm (5db) |
| 30M | 475 | 300 | 150mm (5db) |
| 35M | 550 | 350 | 180mm (5db) |

---

## WWF Reference (RSIC Chapter 11)

| Designation | Wire Ø (mm) | Spacing (mm) | Mass (kg/m²) |
|-------------|-------------|--------------|--------------|
| 152x152 MW9.1xMW9.1 | 3.4 | 152 | 1.17 |
| 152x152 MW18.7xMW18.7 | 4.9 | 152 | 2.42 |
| 152x152 MW25.8xMW25.8 | 5.7 | 152 | 3.33 |
| 102x102 MW9.1xMW9.1 | 3.4 | 102 | 1.75 |
| 102x102 MW18.7xMW18.7 | 4.9 | 102 | 3.63 |

**Sheet sizes**: 4ft × 8ft (1220mm × 2440mm) or 8ft × 20ft (2440mm × 6100mm)
**Lap**: One full mesh space + 50mm minimum

---

## RSIC Terminology (Glossary)

- **BEW**: Bottom Each Way
- **TEW**: Top Each Way
- **B.O.F.**: Bottom of Footing
- **T.O.F.**: Top of Footing
- **CJ**: Construction Joint
- **EQ**: Equal spacing
- **SYM**: Symmetrical
- **TYP**: Typical
- **E.F.**: Each Face
- **NF/FF**: Near Face / Far Face

---

You have access to quotes, orders, historical job data, AND RSIC 2018 standards from the database context.`,
};

// Fetch rebar standards from database
async function fetchRebarStandards(supabase: ReturnType<typeof createClient>): Promise<{
  rebarStandards: RebarStandard[];
  wwmStandards: unknown[];
  validationRules: ValidationRule[];
}> {
  const result = {
    rebarStandards: [] as RebarStandard[],
    wwmStandards: [] as unknown[],
    validationRules: [] as ValidationRule[],
  };

  try {
    // Get rebar standards
    const { data: rebar } = await supabase
      .from("rebar_standards")
      .select("*")
      .order("bar_size_mm", { ascending: true });
    result.rebarStandards = rebar || [];

    // Get WWM standards
    const { data: wwm } = await supabase
      .from("wwm_standards")
      .select("*")
      .order("weight_per_m2", { ascending: true });
    result.wwmStandards = wwm || [];

    // Get validation rules
    const { data: rules } = await supabase
      .from("estimation_validation_rules")
      .select("*")
      .eq("is_active", true);
    result.validationRules = rules || [];

  } catch (error) {
    console.error("Error fetching standards:", error);
  }

  return result;
}

// Fetch learnings for estimation agent
async function fetchEstimationLearnings(supabase: ReturnType<typeof createClient>) {
  const learnings: {
    patterns: Record<string, unknown>[];
    rebarStandards: Record<string, unknown>[];
    clientPreferences: Record<string, unknown>[];
    corrections: Record<string, unknown>[];
  } = {
    patterns: [],
    rebarStandards: [],
    clientPreferences: [],
    corrections: [],
  };

  try {
    const { data: patterns } = await supabase
      .from("estimation_learnings")
      .select("*")
      .eq("is_global", true)
      .eq("learning_type", "pattern")
      .order("usage_count", { ascending: false })
      .limit(20);
    learnings.patterns = patterns || [];

    const { data: rebarStandards } = await supabase
      .from("estimation_learnings")
      .select("*")
      .in("learning_type", ["rebar_standard", "wwm_standard", "scale_reference"])
      .order("confidence_score", { ascending: false })
      .limit(15);
    learnings.rebarStandards = rebarStandards || [];

    const { data: corrections } = await supabase
      .from("estimation_learnings")
      .select("*")
      .eq("learning_type", "correction")
      .order("created_at", { ascending: false })
      .limit(10);
    learnings.corrections = corrections || [];

    const { data: clientPrefs } = await supabase
      .from("estimation_learnings")
      .select("*")
      .eq("learning_type", "client_preference")
      .order("usage_count", { ascending: false })
      .limit(10);
    learnings.clientPreferences = clientPrefs || [];

  } catch (error) {
    console.error("Error fetching estimation learnings:", error);
  }

  return learnings;
}

async function fetchContext(supabase: ReturnType<typeof createClient>, agent: string, userId?: string) {
  const context: Record<string, unknown> = {};

  try {
    const { data: comms } = await supabase
      .from("communications")
      .select("id, subject, from_address, to_address, body_preview, status, source, received_at, customer_id")
      .order("received_at", { ascending: false })
      .limit(15);
    context.recentEmails = comms;

    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name, status, payment_terms, credit_limit")
      .limit(15);
    context.customers = customers;

    if (agent === "sales" || agent === "support" || agent === "estimation") {
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_id, total_amount, status, margin_percent")
        .in("status", ["draft", "sent"])
        .order("created_at", { ascending: false })
        .limit(10);
      context.openQuotes = quotes;

      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total_amount, status, order_date")
        .order("created_at", { ascending: false })
        .limit(10);
      context.recentOrders = orders;
    }

    if (agent === "accounting" || agent === "collections") {
      const { data: arData } = await supabase
        .from("accounting_mirror")
        .select("id, entity_type, balance, customer_id, last_synced_at, data")
        .eq("entity_type", "invoice")
        .gt("balance", 0)
        .limit(15);
      context.outstandingAR = arData;
    }

    if (agent === "support") {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority, source, customer_id, due_date")
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(10);
      context.openTasks = tasks;

      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_number, driver_name, status, scheduled_date")
        .in("status", ["planned", "scheduled", "in-transit"])
        .limit(10);
      context.activeDeliveries = deliveries;

      const { data: workOrders } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, scheduled_start, order_id")
        .in("status", ["queued", "pending", "in-progress"])
        .limit(10);
      context.activeWorkOrders = workOrders;
    }

    if (agent === "estimation") {
      const { data: historicalQuotes } = await supabase
        .from("quotes")
        .select("id, quote_number, total_amount, margin_percent, status, created_at")
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(10);
      context.historicalQuotes = historicalQuotes;

      // Fetch learnings
      const learnings = await fetchEstimationLearnings(supabase);
      context.estimationLearnings = learnings;
      
      // Fetch rebar standards from database
      const standards = await fetchRebarStandards(supabase);
      context.rebarStandards = standards.rebarStandards;
      context.wwmStandards = standards.wwmStandards;
      context.validationRules = standards.validationRules;
    }

    if (agent === "sales") {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, title, stage, expected_value, probability, customer_id")
        .order("updated_at", { ascending: false })
        .limit(10);
      context.pipelineLeads = leads;
    }

  } catch (error) {
    console.error("Error fetching context:", error);
  }

  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { agent, message, history = [], context: userContext, attachedFiles = [] }: AgentRequest = await req.json();

    if (!agent || !message) {
      return new Response(
        JSON.stringify({ error: "Missing agent or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dbContext = await fetchContext(supabase, agent);
    const mergedContext = { ...dbContext, ...userContext };

    // Get validation rules for OCR validation
    const validationRules = (dbContext.validationRules as ValidationRule[]) || [];

    // For estimation agent, analyze attached files
    let documentResults: { 
      fileName: string; 
      text: string; 
      confidence: number; 
      discrepancies: string[]; 
      fileType: string;
      zones: DetectedZone[];
      extractedRebar: ExtractedRebarData[];
    }[] = [];
    
    if (agent === "estimation" && attachedFiles.length > 0) {
      console.log(`Processing ${attachedFiles.length} files for analysis...`);
      
      for (const file of attachedFiles) {
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(file.name);
        const isPdf = /\.pdf$/i.test(file.name);
        const isDwg = /\.(dwg|dxf)$/i.test(file.name);
        
        if (isImage || isPdf) {
          console.log(`Analyzing ${isPdf ? 'PDF' : 'image'}: ${file.name}`);
          const result = await performMultiPassAnalysis(file.url, file.name, isPdf, validationRules);
          documentResults.push({
            fileName: file.name,
            text: result.mergedText,
            confidence: result.confidence,
            discrepancies: result.discrepancies,
            fileType: isPdf ? 'PDF' : 'Image',
            zones: result.zones,
            extractedRebar: result.extractedRebar,
          });
        } else if (isDwg) {
          documentResults.push({
            fileName: file.name,
            text: `⚠️ فایل ${file.name} از نوع CAD است و باید به PDF تبدیل شود. لطفاً نسخه PDF نقشه را آپلود کنید.`,
            confidence: 0,
            discrepancies: ["CAD file needs conversion to PDF"],
            fileType: 'CAD',
            zones: [],
            extractedRebar: [],
          });
        }
      }
      
      if (documentResults.length > 0) {
        mergedContext.documentResults = documentResults;
      }
    }

    const systemPrompt = agentPrompts[agent] || agentPrompts.sales;
    
    let contextStr = "";
    if (Object.keys(mergedContext).length > 0) {
      contextStr = `\n\nCurrent data context:\n${JSON.stringify(mergedContext, null, 2)}`;
    }
    
    // Enhanced document analysis summary with zones and validation
    if (agent === "estimation" && documentResults.length > 0) {
      contextStr += "\n\n📋 DOCUMENT ANALYSIS RESULTS FROM ATTACHED DRAWINGS:\n";
      for (const doc of documentResults) {
        contextStr += `\n--- ${doc.fileName} [${doc.fileType}] (Confidence: ${doc.confidence.toFixed(0)}%) ---\n`;
        
        // Show detected zones
        if (doc.zones.length > 0) {
          contextStr += `\n🔍 DETECTED ZONES:\n`;
          for (const zone of doc.zones) {
            contextStr += `  [${zone.type.toUpperCase()}] (${zone.confidence}% confidence)\n`;
            contextStr += `  ${zone.content.substring(0, 500)}...\n\n`;
          }
        }
        
        // Show extracted rebar data
        if (doc.extractedRebar.length > 0) {
          contextStr += `\n📊 AUTO-EXTRACTED REBAR DATA:\n`;
          for (const rebar of doc.extractedRebar) {
            contextStr += `  • ${rebar.mark}: Ø${rebar.diameter}mm`;
            if (rebar.quantity > 0) contextStr += `, Qty: ${rebar.quantity}`;
            if (rebar.spacing) contextStr += `, @${rebar.spacing}mm`;
            if (rebar.warnings.length > 0) {
              contextStr += `\n    ${rebar.warnings.join(', ')}`;
            }
            contextStr += `\n`;
          }
        }
        
        // Show discrepancies/warnings
        if (doc.discrepancies.length > 0) {
          contextStr += `\n⚠️ VALIDATION WARNINGS:\n`;
          contextStr += doc.discrepancies.map(d => `  • ${d}`).join('\n');
          contextStr += '\n';
        }
        
        // Full OCR text
        contextStr += `\n📄 FULL OCR TEXT:\n${doc.text}\n`;
      }
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt + contextStr },
      ...history.slice(-10),
      { role: "user", content: message },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: agent === "estimation" ? 4000 : 1000,
        temperature: agent === "estimation" ? 0.3 : 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "I couldn't process that request.";

    return new Response(
      JSON.stringify({ reply, context: mergedContext }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
