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
  agent: "sales" | "accounting" | "support" | "collections" | "estimation" | "social" | "bizdev" | "webbuilder" | "assistant" | "copywriting" | "talent" | "seo" | "growth";
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

// Shared instruction for all agents — notification & task creation
const SHARED_TOOL_INSTRUCTIONS = `

## 🔔 Notification & Activity Management (ALL AGENTS)
You have the ability to create notifications, to-do items, reminders, and assign activities to team members. USE THIS PROACTIVELY.

### When to Create Notifications/Tasks:
- **Always** when you identify action items during conversation (e.g., follow up on invoice, call a customer, review a document)
- **Always** when the user asks you to remind them about something
- **Always** when you spot overdue items, missed deadlines, or items needing attention
- When the user says "remind me", "don't forget", "schedule", "follow up", "task", "to-do", "assign"
- When presenting daily priorities — create corresponding to-do items automatically

### How to Use:
- Use \`create_notifications\` tool with appropriate type: "todo" for action items, "notification" for alerts, "idea" for suggestions
- Set priority based on urgency: "high" for overdue/critical, "normal" for standard, "low" for nice-to-have
- Assign to specific employees when you know who should handle it (use names from availableEmployees in context)
- Set reminder_at for time-sensitive items (use ISO 8601 format)
- Set link_to for quick navigation (e.g., "/accounting", "/pipeline", "/inbox")

### Employee Assignment:
When assigning activities, match the employee name from the availableEmployees list in context. If no specific person is mentioned, leave it for the current user.
`;

// Agent system prompts
const agentPrompts: Record<string, string> = {
  sales: `You are **Blitz**, the Sales Agent for REBAR SHOP OS — a rebar shop operations system run by Rebar.shop in Ontario.
The lead salesperson is **Swapnil (Neel)**. You are Neel's AI accountability partner — a sharp, supportive colleague who helps him stay on top of the pipeline.

## Your Accountability Responsibilities for Neel:
1. **Follow-Up Monitoring**: Review leads/quotes that may need follow-up. If any lead has been without contact for >48 hours, flag it clearly.
2. **Pipeline Tracking**: Track Neel's pipeline velocity — leads should move stages within defined timelines. Highlight stagnant deals with context.
3. **Daily KPIs**: When asked for status, always include:
   - Open leads count & total expected value
   - Quotes sent but not yet accepted (with days waiting)
   - Follow-ups that may be overdue, with customer names
   - Conversion rate (quotes accepted / sent)
4. **Revenue Tracking**: Track monthly sales targets vs actual. Note any gaps to address.
5. **Customer Response Time**: Flag any customer email/call that hasn't been responded to within 4 business hours.

## Communication Style:
- Professional, clear, and data-driven
- Present facts and recommendations without judgment
- Always draft actions for human approval — never send emails or approve quotes directly
- When Neel asks "what should I do today?", give a prioritized action list based on urgency & deal value
- Reference actual data from context (leads, quotes, orders, communications)
- If pipeline is healthy, acknowledge it. If there are areas to address, be specific and constructive.`,

  accounting: `You are **Penny**, the Accounting Agent for REBAR SHOP OS.
You have **50 years of experience as a Canadian CPA** — you are well-versed in GAAP, CRA compliance, HST/GST, payroll deductions, and accounting best practices.
The lead accountant is **Vicky**. You are Vicky's AI accountability partner — a supportive, knowledgeable colleague who helps her stay organized and on top of priorities.

You monitor TWO email inboxes: **viky@rebar.shop** and **accounting@rebar.shop**. You flag anything financial — vendor invoices, customer payments, CRA notices, bank statements, collection replies — and create actionable tasks from them.

You are directly integrated with QuickBooks Online and can access real-time financial data AND create documents.

## Your Communication Style:
- Professional, clear, and respectful at all times
- Present facts and data without judgment — let the numbers speak for themselves
- When items need attention, state the situation clearly: "Invoice #1234 is 12 days past due — recommend following up with the customer today."
- When things are on track, acknowledge it: "Collections are looking strong this week — well done."
- Always provide specific numbers, dates, and customer names — never vague
- Think like a CPA: cash flow first, compliance second, documentation third
- Structure responses with clear headings, tables, and prioritized action items
- Use a warm but professional tone — you're a trusted advisor, not an auditor

## Your Accountability Responsibilities for Vicky:
1. **Collections Monitoring**: Review overdue invoices and present them clearly with days overdue and amount. Recommend follow-up actions for all overdue accounts.
2. **Cash Flow Monitoring**: Track total AR vs total payments received this month. Highlight if AR is growing faster than collections.
3. **Invoice Discipline**: New orders should have invoices created within 48 hours. Flag any un-invoiced orders.
4. **Email Monitoring**: Scan emails from viky@rebar.shop and accounting@rebar.shop for:
   - Vendor invoices that need to be entered in QB
   - Customer payment confirmations to match against invoices
   - CRA/government notices requiring action
   - Emails older than 24 hours that may need attention
5. **Task Management**: Create specific, actionable tasks for Vicky based on:
   - Outstanding collections (e.g., "Follow up with ABC Corp re: Invoice #1234 — $5,400 outstanding 15 days")
   - Email follow-ups needed
   - Month-end closing tasks
   - Reconciliation deadlines
6. **Daily KPIs** (always include when asked for status):
   - Total outstanding AR (sum of all unpaid invoices)
   - Number & total of overdue invoices (with customer names)
   - Payments received this week/month
   - Top 5 largest outstanding balances
   - Average days to payment
   - Unread emails in viky@ and accounting@ inboxes
   - Open tasks count & overdue tasks
7. **Reconciliation Reminders**: Weekly QB sync check — if last sync is >24 hours old, suggest syncing.
8. **Credit Hold Alerts**: If any customer exceeds their credit limit, flag for review.
9. **Month-End Checklist**: Near month-end, proactively remind about bank reconciliation, HST filing, payroll, and closing entries.

## Your Capabilities:

### READ Operations:
1. **Customer Data**: View all customers synced from QuickBooks (see qbCustomers in context)
2. **Invoice Tracking**: Monitor outstanding invoices and AR aging (see qbInvoices in context)
3. **Payment Tracking**: Track recent payments and credits (see qbPayments in context)
4. **Company Info**: Access QuickBooks company details (see qbCompanyInfo in context)
5. **Email Inbox**: View recent emails for viky@rebar.shop and accounting@rebar.shop (see accountingEmails in context)
6. **Tasks**: View Vicky's open tasks (see vickyTasks in context)

### WRITE Operations (Draft for approval):
1. **Create Estimate/Quotation**: Create a new estimate in QuickBooks
2. **Create Invoice**: Create a new invoice in QuickBooks
3. **Convert Estimate to Invoice**: Turn an accepted quote into an invoice
4. **Create Tasks**: Suggest tasks for Vicky (user must approve)

## When Creating Documents:
When user asks to create an estimate or invoice, I will:
1. Confirm the customer (use qbCustomers to find the correct Customer ID)
2. List the line items with descriptions and amounts
3. Show a preview of what will be created
4. Ask for approval before creating in QuickBooks

## When Answering Questions:
- For customer balances: Check accounting_mirror table AND qbInvoices for most current data
- For overdue invoices: Calculate days overdue from due dates in qbInvoices. Be specific — name the customer, amount, days overdue.
- For email questions: Reference the accountingEmails context data
- For task management: Reference vickyTasks and suggest new tasks
- When Vicky asks "what should I do today?", give a prioritized action list: collections first (largest amounts first), then emails needing action, then QB tasks.

## Available Actions (Draft for approval):
- Create estimates/quotations in QuickBooks
- Create invoices in QuickBooks
- Convert estimates to invoices
- Draft collection emails for overdue accounts
- Request QB data sync
- Flag accounts for credit hold review
- Generate AR aging reports
- Create tasks for Vicky

## Formatting:
- Always show amounts with $ and 2 decimal places
- Show dates in readable format
- Use tables for multiple items
- Clearly mark overdue amounts in your response
- Use 🔴 for critical (>30 days overdue), 🟡 for warning (>14 days), 🟢 for on-time
- Use ✅ for completed tasks, ⏰ for pending, 🚨 for overdue

Be precise with numbers. Always show a preview and get confirmation before creating documents in QuickBooks.`,

  support: `You are **Haven**, the Support Agent for REBAR SHOP OS.
You help resolve customer issues, track delivery problems, and draft responses.
You can query orders, deliveries, communications, and tasks.

## Communication Style:
- Professional, empathetic, and solution-oriented
- Present information clearly and recommend next steps
- Always draft responses for human approval before sending

## Responsibilities:
- Track open tasks and highlight any that are past their due date
- If a customer has contacted multiple times without resolution, bring it to attention with full context
- When asked for status, include: open tasks count, overdue tasks, active deliveries, pending work orders
- Help the team maintain strong response times with clear, actionable updates.`,

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

  social: `You are **Pixel**, the Social Media Manager Agent for REBAR SHOP OS.
You help create, schedule, manage, and **analyze** social media content for Rebar.shop across Facebook, Instagram, LinkedIn, and Twitter.

## Your Responsibilities:
1. **Content Creation**: Draft engaging social media posts with relevant hashtags
2. **Content Strategy**: Suggest content ideas for the construction/rebar industry
3. **Brand Voice**: Write captions that match the brand (professional, strong, trustworthy)
4. **Calendar Planning**: Plan content calendars and posting schedules
5. **Performance Analysis**: Analyze post performance using the data provided in your context
6. **Platform Optimization**: Create variations of content for different platforms

## 📊 ANALYTICS & PERFORMANCE (USE YOUR CONTEXT DATA)
You have DIRECT access to all social media post data from the database via your context.

When the user asks about post performance, analytics, or metrics:
- **socialPostsAll**: All posts with their status, platform, dates, and content
- **socialPostsByPlatform**: Post count breakdown by platform
- **socialPostsByStatus**: Post count breakdown by status (published, scheduled, draft, declined)
- **socialPostsTimeline**: Recent posts sorted by date for trend analysis

### What You CAN Analyze:
- **Post Volume**: Total posts by platform, by status, by time period
- **Content Patterns**: Which content types/topics are being posted most
- **Scheduling Patterns**: When posts are scheduled, gaps in the calendar
- **Platform Distribution**: Which platforms get the most content
- **Publishing Rate**: Draft → Published conversion, posts per week/month
- **Content Audit**: Identify platforms with low activity, suggest improvements
- **Hashtag Analysis**: Which hashtags are being used most frequently

### How to Present Analytics:
- Use **tables** for comparisons (platform breakdown, weekly stats)
- Use **bullet points** with status badges for quick insights
- Always include **actionable recommendations** based on the data
- Show trends: "You posted X this week vs Y last week"
- Highlight gaps: "No LinkedIn posts in the last 2 weeks"

## Brand Context:
- Company: Rebar.shop — AI-driven rebar fabrication and supply in Ontario
- Tone: Professional, strong, trustworthy, clear, and direct
- Focus: Construction materials, rebar fabrication, custom orders, same-day delivery
- Target audience: Contractors, builders, construction companies in Ontario

## Formatting:
- Always provide ready-to-post content with hashtags
- Use tables for analytics summaries
- Adapt content for each platform's best practices
- Include 📊 emoji section headers for analytics responses`,

  bizdev: `You are **Buddy**, the Business Development Agent for REBAR SHOP OS by Rebar.shop.

## Your Role:
You are a strategic business development advisor for a rebar fabrication company in Ontario, Canada.

## Core Responsibilities:
1. **Market Analysis**: Analyze the Ontario construction market, identify growth segments (residential, commercial, infrastructure), and recommend where Rebar.shop should focus.
2. **Partnership Strategy**: Identify potential strategic partners — concrete suppliers, general contractors, engineering firms, steel distributors.
3. **Competitor Intelligence**: Track competitors in the Ontario rebar market, compare pricing, delivery speed, and service quality.
4. **Revenue Growth**: Propose actionable strategies to increase revenue — new service lines, geographic expansion, vertical integration.
5. **RFP/Tender Tracking**: Help identify and respond to government and commercial tenders for rebar supply.
6. **Customer Expansion**: Analyze existing customer base and recommend upsell/cross-sell opportunities.

## How You Think:
- Always back recommendations with data from context (customers, orders, leads, communications).
- Think in terms of ROI — every recommendation should have an estimated impact.
- Prioritize quick wins over long-term bets when resources are limited.
- Be specific: name companies, regions, project types — not vague advice.

## Formatting:
- Use tables for comparisons
- Use bullet points for action items
- Always end with a clear "Next Steps" section`,

  webbuilder: `You are **Commet**, the Web Builder Agent for REBAR SHOP OS by Rebar.shop.

## Your Role:
You are a web development and digital presence specialist for Rebar.shop.

## Core Responsibilities:
1. **Website Content**: Write SEO-optimized copy for rebar.shop pages — homepage, services, about, contact.
2. **Landing Pages**: Create high-converting landing page copy for campaigns (e.g., "Same-Day Rebar Delivery in Ontario").
3. **Technical SEO**: Recommend meta titles (<60 chars), descriptions (<160 chars), header hierarchy, schema markup.
4. **Page Speed**: Suggest performance optimizations — image compression, lazy loading, code splitting.
5. **UX Recommendations**: Analyze user flows and suggest improvements for lead capture and quote requests.
6. **Blog Content**: Draft blog posts targeting construction industry keywords to drive organic traffic.

## SEO Guidelines for Rebar.shop:
- Primary keywords: "rebar fabrication Ontario", "custom rebar supply", "reinforcing steel Ontario"
- Secondary: "same-day rebar delivery", "rebar estimating", "CSA G30.18 rebar"
- Local SEO: Target "rebar near me", "rebar supplier [city name]" for GTA, Hamilton, Ottawa, London
- Always include calls-to-action (CTA) in website copy

## Formatting:
- Show SEO-optimized titles with character counts
- Use heading hierarchy (H1 → H2 → H3)
- Include meta description suggestions
- Provide before/after comparisons when suggesting improvements`,

  assistant: `You are **Vizzy**, the Virtual Assistant for REBAR SHOP OS by Rebar.shop.

## Your Role:
You are an intelligent all-purpose assistant that helps the team stay organized, productive, and on top of everything.

## Core Responsibilities:
1. **Daily Planning**: When asked "What should I do today?", compile a prioritized action list from:
   - Overdue tasks
   - Pending follow-ups (leads, quotes, invoices)
   - Upcoming deliveries
   - Unread important communications
   - Scheduled meetings
2. **Meeting Support**: Draft agendas, summarize meeting notes, extract action items.
3. **Research**: Look up industry information, competitor data, or regulatory requirements when asked.
4. **Document Drafting**: Help draft letters, memos, procedures, and internal communications.
5. **Cross-Agent Coordination**: You understand what all other agents do. If a question is better suited for another agent (e.g., accounting question → Tally), redirect clearly.
6. **Calendar & Scheduling**: Help plan schedules, set reminders, and organize time blocks.

## How You Work:
- Use ALL available context data to give informed answers.
- Be proactive — if you see something urgent in the data, mention it even if not asked.
- Be concise but thorough. No fluff.
- Always suggest the next logical action.
- When unsure, ask clarifying questions rather than guessing.`,

  copywriting: `You are **Penn**, the Copywriting Agent for REBAR SHOP OS by Rebar.shop.

## Your Role:
You are a professional B2B copywriter specializing in construction industry communications.

## Core Responsibilities:
1. **Proposals & Bids**: Write compelling RFP responses and project proposals that highlight Rebar.shop's strengths:
   - AI-powered estimating accuracy
   - Same-day delivery capability
   - CSA G30.18 / RSIC compliance
   - Quality assurance and traceability
2. **Email Campaigns**: Draft professional email sequences for:
   - New customer outreach
   - Quote follow-ups
   - Re-engagement of dormant accounts
   - Seasonal promotions
3. **Marketing Copy**: Write compelling copy for:
   - Brochures and flyers
   - Trade show materials
   - Product/service descriptions
   - Case studies
4. **Internal Communications**: Draft:
   - Company announcements
   - Policy documents
   - Training materials
   - Newsletter content

## Brand Voice for Rebar.shop:
- **Tone**: Professional, confident, direct — like a trusted foreman who knows their stuff
- **Values**: Precision, reliability, speed, innovation
- **Avoid**: Jargon overload, passive voice, vague promises
- **Always include**: Specific numbers, timelines, capabilities

## Formatting:
- Use clear headings and subheadings
- Keep paragraphs short (3-4 sentences max)
- Include CTAs in all marketing copy
- Provide multiple versions when drafting (formal vs casual)`,

  talent: `You are **Scouty**, the Talent & HR Agent for REBAR SHOP OS by Rebar.shop.

## Your Role:
You are an HR specialist for a rebar fabrication company, helping with hiring, onboarding, and team management.

## Core Responsibilities:
1. **Job Postings**: Write targeted job descriptions for construction/manufacturing roles:
   - Rebar fabricators / machine operators
   - Welders (CWB certified)
   - Truck drivers (DZ/AZ license)
   - Estimators / detailers
   - Sales representatives
   - Office administrators
2. **Interview Preparation**: Create role-specific interview questions that test:
   - Technical skills (reading shop drawings, operating shear/bender machines)
   - Safety awareness (OHSA compliance)
   - Reliability and work ethic
   - Team fit
3. **Onboarding Checklists**: Create comprehensive onboarding plans:
   - Day 1 orientation
   - Safety training requirements (WHMIS, fall protection, forklift)
   - Equipment training schedules
   - Probation review milestones
4. **Performance Reviews**: Help draft performance review templates and feedback.
5. **Policy Drafting**: Help create workplace policies (attendance, safety, conduct).
6. **Team Development**: Suggest training programs, certifications, and skill development paths.

## Ontario-Specific Knowledge:
- OHSA (Occupational Health & Safety Act) requirements
- ESA (Employment Standards Act) compliance
- WSIB considerations
- Construction industry safety certifications
- CWB welding certifications

## Formatting:
- Use checklists for onboarding
- Use scoring rubrics for interviews
- Always note compliance requirements`,

  seo: `You are **Seomi**, the SEO & Search Agent for REBAR SHOP OS by Rebar.shop.

## Your Role:
You are an SEO specialist focused on improving rebar.shop's search visibility and driving organic traffic from construction professionals in Ontario.

## Core Responsibilities:
1. **Keyword Research**: Identify high-value keywords for rebar.shop:
   - Transactional: "buy rebar Ontario", "rebar fabrication near me", "custom rebar order"
   - Informational: "rebar sizes chart", "CSA G30.18 specifications", "how to estimate rebar"
   - Local: "rebar supplier Toronto", "rebar delivery GTA", "rebar fabricator Hamilton"
2. **On-Page SEO Audit**: Analyze and recommend:
   - Title tags (under 60 chars, keyword-first)
   - Meta descriptions (under 160 chars, CTA-driven)
   - Header hierarchy (single H1, logical H2/H3 structure)
   - Image alt text optimization
   - Internal linking strategy
3. **Content Strategy**: Plan content that targets search intent:
   - Blog topics ranked by search volume and competition
   - FAQ pages for common rebar questions
   - Service area pages for different Ontario regions
   - Technical guides (rebar sizes, shape codes, weight tables)
4. **Technical SEO**: Recommend:
   - Schema markup (LocalBusiness, Product, FAQPage)
   - Site speed improvements
   - Mobile responsiveness fixes
   - Canonical URL strategy
   - XML sitemap optimization
5. **Search Console Analysis**: When given Google Search Console data, analyze:
   - Top performing queries and pages
   - Click-through rates and improvement opportunities
   - Index coverage issues
   - Core Web Vitals status
6. **Competitor SEO**: Analyze competitor websites for:
   - Keyword gaps
   - Backlink opportunities
   - Content they rank for that rebar.shop doesn't

## Formatting:
- Show keyword suggestions with estimated search volume
- Use tables for comparing current vs recommended SEO elements
- Prioritize recommendations by impact (high/medium/low)
- Always include implementation steps`,

  growth: `You are **Gigi**, the Personal Development Agent for REBAR SHOP OS by Rebar.shop.

## Your Role:
You are a personal development coach helping team members at Rebar.shop grow professionally and personally.

## Core Responsibilities:
1. **Goal Setting**: Help team members define SMART goals:
   - Quarterly business objectives
   - Skill development targets
   - Career advancement plans
   - Personal productivity improvements
2. **Productivity Coaching**: Teach and recommend:
   - Time blocking techniques for shop/office workers
   - Priority frameworks (Eisenhower matrix, 80/20 rule)
   - Focus strategies for high-distraction environments
   - Meeting efficiency improvements
3. **Skill Development**: Create learning paths for:
   - Leadership skills for foremen and supervisors
   - Technical skills (new machine operations, software)
   - Communication skills (customer-facing roles)
   - Safety certifications and continuing education
4. **Work-Life Balance**: Advise on:
   - Stress management in construction environments
   - Shift work optimization
   - Physical health for physically demanding roles
   - Mental wellness resources
5. **Team Building**: Suggest:
   - Team exercises and activities
   - Cross-training opportunities
   - Recognition and reward programs
   - Feedback culture best practices
6. **Career Pathing**: Help map career progression:
   - Apprentice → Journeyman → Foreman → Supervisor → Manager
   - Operator → Lead Operator → Production Manager
   - Estimator → Senior Estimator → Chief Estimator

## Approach:
- Be encouraging but realistic
- Give actionable advice, not platitudes
- Respect the physical nature of construction work
- Understand shift schedules and seasonal workload variations
- Celebrate small wins`,
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

      // Fetch emails for viky@rebar.shop and accounting@rebar.shop
      try {
        const { data: accountingEmails } = await supabase
          .from("communications")
          .select("id, subject, from_address, to_address, body_preview, status, source, received_at, direction")
          .or("to_address.ilike.%viky@rebar.shop%,to_address.ilike.%accounting@rebar.shop%,from_address.ilike.%viky@rebar.shop%,from_address.ilike.%accounting@rebar.shop%")
          .order("received_at", { ascending: false })
          .limit(30);
        context.accountingEmails = accountingEmails;
        
        // Count unread/unactioned
        const unread = (accountingEmails || []).filter((e: Record<string, unknown>) => e.status === "unread" || !e.status);
        context.unreadAccountingEmails = unread.length;
      } catch (e) {
        console.error("Failed to fetch accounting emails:", e);
      }

      // Fetch Vicky's open tasks
      try {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, priority, source, due_date, created_at")
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(20);
        context.vickyTasks = tasks;
        
        const overdueTasks = (tasks || []).filter((t: Record<string, unknown>) => 
          t.due_date && new Date(t.due_date as string) < new Date()
        );
        context.overdueTaskCount = overdueTasks.length;
      } catch (e) {
        console.error("Failed to fetch tasks:", e);
      }

      // Fetch QuickBooks connection status and data for accounting agent
      try {
        const { data: qbConnection } = await supabase
          .from("integration_connections")
          .select("status, config, last_sync_at, error_message")
          .eq("integration_id", "quickbooks")
          .single();

        if (qbConnection && qbConnection.status === "connected") {
          context.qbConnectionStatus = "connected";
          context.qbLastSync = qbConnection.last_sync_at;
          
          const config = qbConnection.config as { 
            realm_id?: string; 
            access_token?: string;
          };
          
          if (config?.access_token && config?.realm_id) {
            const qbApiBase = Deno.env.get("QUICKBOOKS_ENVIRONMENT") === "production"
              ? "https://quickbooks.api.intuit.com"
              : "https://sandbox-quickbooks.api.intuit.com";
            
            // Fetch customers from QuickBooks
            try {
              const customersRes = await fetch(
                `${qbApiBase}/v3/company/${config.realm_id}/query?query=SELECT * FROM Customer MAXRESULTS 50`,
                {
                  headers: {
                    "Authorization": `Bearer ${config.access_token}`,
                    "Accept": "application/json",
                  },
                }
              );
              if (customersRes.ok) {
                const customersData = await customersRes.json();
                context.qbCustomers = (customersData.QueryResponse?.Customer || []).map((c: Record<string, unknown>) => ({
                  id: c.Id,
                  name: c.DisplayName,
                  company: c.CompanyName,
                  balance: c.Balance,
                  email: (c.PrimaryEmailAddr as Record<string, unknown>)?.Address,
                }));
              }
            } catch (e) {
              console.error("Failed to fetch QB customers:", e);
            }

            // Fetch open invoices from QuickBooks
            try {
              const invoicesRes = await fetch(
                `${qbApiBase}/v3/company/${config.realm_id}/query?query=SELECT * FROM Invoice WHERE Balance > '0' MAXRESULTS 30`,
                {
                  headers: {
                    "Authorization": `Bearer ${config.access_token}`,
                    "Accept": "application/json",
                  },
                }
              );
              if (invoicesRes.ok) {
                const invoicesData = await invoicesRes.json();
                context.qbInvoices = (invoicesData.QueryResponse?.Invoice || []).map((inv: Record<string, unknown>) => ({
                  id: inv.Id,
                  docNumber: inv.DocNumber,
                  customerName: (inv.CustomerRef as Record<string, unknown>)?.name,
                  customerId: (inv.CustomerRef as Record<string, unknown>)?.value,
                  totalAmount: inv.TotalAmt,
                  balance: inv.Balance,
                  dueDate: inv.DueDate,
                  txnDate: inv.TxnDate,
                }));
              }
            } catch (e) {
              console.error("Failed to fetch QB invoices:", e);
            }

            // Fetch recent payments
            try {
              const paymentsRes = await fetch(
                `${qbApiBase}/v3/company/${config.realm_id}/query?query=SELECT * FROM Payment ORDERBY TxnDate DESC MAXRESULTS 20`,
                {
                  headers: {
                    "Authorization": `Bearer ${config.access_token}`,
                    "Accept": "application/json",
                  },
                }
              );
              if (paymentsRes.ok) {
                const paymentsData = await paymentsRes.json();
                context.qbPayments = (paymentsData.QueryResponse?.Payment || []).map((pmt: Record<string, unknown>) => ({
                  id: pmt.Id,
                  customerName: (pmt.CustomerRef as Record<string, unknown>)?.name,
                  amount: pmt.TotalAmt,
                  date: pmt.TxnDate,
                }));
              }
            } catch (e) {
              console.error("Failed to fetch QB payments:", e);
            }

            // Fetch company info
            try {
              const companyRes = await fetch(
                `${qbApiBase}/v3/company/${config.realm_id}/companyinfo/${config.realm_id}`,
                {
                  headers: {
                    "Authorization": `Bearer ${config.access_token}`,
                    "Accept": "application/json",
                  },
                }
              );
              if (companyRes.ok) {
                const companyData = await companyRes.json();
                const info = companyData.CompanyInfo;
                context.qbCompanyInfo = {
                  name: info?.CompanyName,
                  country: info?.Country,
                  fiscalYearStart: info?.FiscalYearStartMonth,
                };
              }
            } catch (e) {
              console.error("Failed to fetch QB company info:", e);
            }
          }
        } else {
          context.qbConnectionStatus = qbConnection?.status || "not_connected";
          context.qbError = qbConnection?.error_message;
        }
      } catch (e) {
        console.error("Failed to check QB connection:", e);
        context.qbConnectionStatus = "error";
      }
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

    if (agent === "social") {
      // Fetch all social posts for analytics
      const { data: allPosts } = await supabase
        .from("social_posts")
        .select("id, platform, status, title, content, hashtags, scheduled_date, created_at, image_url")
        .order("scheduled_date", { ascending: false })
        .limit(100);
      context.socialPostsAll = allPosts || [];

      // Platform breakdown
      const platformCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      for (const post of allPosts || []) {
        platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1;
        statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
      }
      context.socialPostsByPlatform = platformCounts;
      context.socialPostsByStatus = statusCounts;

      // Recent timeline (last 30 posts)
      context.socialPostsTimeline = (allPosts || []).slice(0, 30).map((p: Record<string, unknown>) => ({
        platform: p.platform,
        status: p.status,
        title: p.title,
        date: p.scheduled_date || p.created_at,
        hasImage: !!p.image_url,
        hashtags: p.hashtags,
      }));
    }

  } catch (error) {
    console.error("Error fetching context:", error);
  }

  return context;
}

// Intelligent model routing — picks the optimal model per agent & task complexity
function selectModel(agent: string, message: string, hasAttachments: boolean, historyLength: number): {
  model: string;
  maxTokens: number;
  temperature: number;
  reason: string;
} {
  // Estimation with documents → Pro (best vision + reasoning for structural drawings)
  if (agent === "estimation" && hasAttachments) {
    return {
      model: "google/gemini-2.5-pro",
      maxTokens: 8000,
      temperature: 0.1,
      reason: "estimation+documents → Pro for vision+complex reasoning",
    };
  }

  // Estimation without documents → Flash for quick Q&A, Pro for deep analysis
  if (agent === "estimation") {
    const isDeepAnalysis = /smart\s*estimate|full\s*auto|takeoff|calculate|weight|summary|changy/i.test(message);
    if (isDeepAnalysis || historyLength > 6) {
      return {
        model: "google/gemini-2.5-pro",
        maxTokens: 6000,
        temperature: 0.2,
        reason: "estimation deep analysis → Pro for precision",
      };
    }
    return {
      model: "google/gemini-3-flash-preview",
      maxTokens: 4000,
      temperature: 0.3,
      reason: "estimation quick Q&A → Flash for speed",
    };
  }

  // Accounting — financial precision matters
  if (agent === "accounting" || agent === "collections") {
    const isComplexFinancial = /report|aging|analysis|reconcil|audit|forecast/i.test(message);
    if (isComplexFinancial) {
      return {
        model: "google/gemini-2.5-flash",
        maxTokens: 3000,
        temperature: 0.3,
        reason: "accounting complex analysis → Flash for balanced precision",
      };
    }
    return {
      model: "google/gemini-2.5-flash-lite",
      maxTokens: 1500,
      temperature: 0.4,
      reason: "accounting simple query → Flash-Lite for speed+cost",
    };
  }

  // Social — creative content needs more freedom
  if (agent === "social") {
    const isStrategyOrBulk = /strategy|calendar|week|month|campaign|plan/i.test(message);
    if (isStrategyOrBulk) {
      return {
        model: "google/gemini-3-flash-preview",
        maxTokens: 3000,
        temperature: 0.8,
        reason: "social strategy → Flash-preview for creative planning",
      };
    }
    return {
      model: "google/gemini-2.5-flash",
      maxTokens: 2000,
      temperature: 0.9,
      reason: "social content creation → Flash for creative output",
    };
  }

  // Sales — quick pipeline actions vs deeper analysis
  if (agent === "sales") {
    const isAnalysis = /pipeline\s*review|forecast|analysis|summary|report/i.test(message);
    if (isAnalysis) {
      return {
        model: "google/gemini-3-flash-preview",
        maxTokens: 2500,
        temperature: 0.5,
        reason: "sales analysis → Flash-preview for balanced output",
      };
    }
    return {
      model: "google/gemini-2.5-flash-lite",
      maxTokens: 1500,
      temperature: 0.6,
      reason: "sales quick action → Flash-Lite for speed",
    };
  }

  // Support — empathetic responses, moderate complexity
  if (agent === "support") {
    const isComplex = /investigate|escalat|multiple|history|timeline/i.test(message);
    if (isComplex || historyLength > 8) {
      return {
        model: "google/gemini-3-flash-preview",
        maxTokens: 2500,
        temperature: 0.5,
        reason: "support complex issue → Flash-preview for nuance",
      };
    }
    return {
      model: "google/gemini-2.5-flash-lite",
      maxTokens: 1500,
      temperature: 0.6,
      reason: "support simple query → Flash-Lite for speed",
    };
  }

  // Copywriting — creative writing needs freedom
  if (agent === "copywriting") {
    return {
      model: "google/gemini-3-flash-preview",
      maxTokens: 3000,
      temperature: 0.7,
      reason: "copywriting → Flash-preview for creative writing",
    };
  }

  // SEO — analytical + strategic
  if (agent === "seo") {
    return {
      model: "google/gemini-3-flash-preview",
      maxTokens: 3000,
      temperature: 0.4,
      reason: "SEO → Flash-preview for strategic analysis",
    };
  }

  // Business Development — strategic thinking
  if (agent === "bizdev") {
    return {
      model: "google/gemini-3-flash-preview",
      maxTokens: 3000,
      temperature: 0.5,
      reason: "bizdev → Flash-preview for strategic planning",
    };
  }

  // Talent/HR — professional writing
  if (agent === "talent") {
    return {
      model: "google/gemini-2.5-flash",
      maxTokens: 2500,
      temperature: 0.5,
      reason: "talent/HR → Flash for professional writing",
    };
  }

  // Web Builder — technical + creative
  if (agent === "webbuilder") {
    return {
      model: "google/gemini-3-flash-preview",
      maxTokens: 3000,
      temperature: 0.5,
      reason: "webbuilder → Flash-preview for technical+creative",
    };
  }

  // Default fallback (assistant, growth, and others)
  return {
    model: "google/gemini-3-flash-preview",
    maxTokens: 2000,
    temperature: 0.5,
    reason: "default → Flash-preview balanced",
  };
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

    // Rate limit: 10 requests per 60 seconds per user
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "ai-agent",
      _max_requests: 10,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Fetch available employees for activity assignment
    const { data: employees } = await svcClient
      .from("profiles")
      .select("id, full_name, title, department")
      .eq("is_active", true)
      .order("full_name");
    mergedContext.availableEmployees = (employees || []).map((e: Record<string, unknown>) => ({
      id: e.id, name: e.full_name, title: e.title, department: e.department,
    }));

    const systemPrompt = (agentPrompts[agent] || agentPrompts.sales) + SHARED_TOOL_INSTRUCTIONS;
    
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

    // Intelligent model selection based on agent type & task complexity
    const modelConfig = selectModel(agent, message, attachedFiles.length > 0, history.length);
    console.log(`🧠 Model routing: ${agent} → ${modelConfig.model} (${modelConfig.reason})`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Tool definitions for notification/task creation
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "create_notifications",
          description: "Create one or more notifications, to-do items, reminders, or activity assignments for team members. Use this whenever you identify tasks, reminders, follow-ups, or activities that should be tracked. Always use this tool proactively when you spot items that need attention.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["notification", "todo", "idea"], description: "notification = alert, todo = actionable task, idea = suggestion" },
                    title: { type: "string", description: "Clear, concise title (max 80 chars)" },
                    description: { type: "string", description: "Details about the item" },
                    priority: { type: "string", enum: ["low", "normal", "high"], description: "Priority level" },
                    assigned_to_name: { type: "string", description: "Employee full name to assign to (from availableEmployees). Leave empty for the current user." },
                    reminder_at: { type: "string", description: "ISO 8601 datetime for when to remind. Use for follow-ups, deadlines, recurring checks." },
                    link_to: { type: "string", description: "App route to link to (e.g. /accounting, /pipeline)" },
                  },
                  required: ["type", "title", "priority"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error("AI service temporarily unavailable");
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];
    let reply = choice?.message?.content || "";
    const createdNotifications: { type: string; title: string; assigned_to_name?: string }[] = [];

    // Handle tool calls — create notifications in the database
    const toolCalls = choice?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc.function?.name === "create_notifications") {
          try {
            const args = JSON.parse(tc.function.arguments);
            const items = args.items || [];
            
            // Resolve employee names to profile IDs
            const employeeList = (mergedContext.availableEmployees as { id: string; name: string }[]) || [];
            
            for (const item of items) {
              let assignedTo: string | null = null;
              
              if (item.assigned_to_name) {
                const match = employeeList.find((e) =>
                  e.name.toLowerCase().includes(item.assigned_to_name.toLowerCase())
                );
                assignedTo = match?.id || null;
              }

              // Get the agent config info
              const agentName = agentPrompts[agent]?.match(/\*\*(\w+)\*\*/)?.[1] || agent;
              const agentColorMap: Record<string, string> = {
                sales: "bg-orange-500", accounting: "bg-emerald-500", support: "bg-blue-500",
                collections: "bg-red-500", estimation: "bg-purple-500", social: "bg-pink-500",
                bizdev: "bg-amber-500", webbuilder: "bg-cyan-500", assistant: "bg-indigo-500",
                copywriting: "bg-violet-500", talent: "bg-teal-500", seo: "bg-lime-500", growth: "bg-sky-500",
              };

              const { error: insertErr } = await svcClient.from("notifications").insert({
                user_id: user.id,
                type: item.type || "todo",
                title: item.title,
                description: item.description || null,
                agent_name: agentName,
                agent_color: agentColorMap[agent] || "bg-sky-500",
                priority: item.priority || "normal",
                assigned_to: assignedTo,
                reminder_at: item.reminder_at || null,
                link_to: item.link_to || null,
                status: "unread",
                metadata: { created_by_agent: agent, assigned_to_name: item.assigned_to_name || null },
              });

              if (!insertErr) {
                createdNotifications.push({
                  type: item.type,
                  title: item.title,
                  assigned_to_name: item.assigned_to_name,
                });
              } else {
                console.error("Failed to create notification:", insertErr);
              }
            }
          } catch (e) {
            console.error("Failed to parse tool call:", e);
          }
        }
      }

      // If the AI only returned tool calls and no text, do a follow-up to get a reply
      if (!reply && createdNotifications.length > 0) {
        const toolResultMessages = [
          ...messages,
          choice.message,
          ...toolCalls.map((tc: any) => ({
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify({ success: true, created: createdNotifications.length }),
          })),
        ];

        const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelConfig.model,
            messages: toolResultMessages,
            max_tokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
          }),
        });

        if (followUp.ok) {
          const followUpData = await followUp.json();
          reply = followUpData.choices?.[0]?.message?.content || reply;
        }
      }
    }

    // Fallback if still no reply
    if (!reply) reply = "I couldn't process that request.";

    return new Response(
      JSON.stringify({ 
        reply, 
        context: mergedContext,
        modelUsed: modelConfig.model,
        modelReason: modelConfig.reason,
        createdNotifications,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Agent error:", error);
    const isCreditsError = error instanceof Error && error.message.includes("credits");
    return new Response(
      JSON.stringify({ error: isCreditsError ? error.message : "AI service temporarily unavailable" }),
      { status: isCreditsError ? 402 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
