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

// OCR function for estimation agent
async function performOCR(imageUrl: string): Promise<{ fullText: string; error?: string }> {
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
      return { fullText: "", error: `OCR failed: ${response.status}` };
    }

    const data = await response.json();
    return { fullText: data.fullText || "" };
  } catch (error) {
    console.error("OCR error:", error);
    return { fullText: "", error: error instanceof Error ? error.message : "OCR failed" };
  }
}

// Multi-pass OCR with cross-reference (as per estimation agent protocol)
async function performMultiPassOCR(imageUrl: string): Promise<{ 
  mergedText: string; 
  passes: string[]; 
  confidence: number;
  discrepancies: string[];
}> {
  const passes: string[] = [];
  const discrepancies: string[] = [];
  
  // Perform 3 OCR passes
  for (let i = 0; i < 3; i++) {
    const result = await performOCR(imageUrl);
    if (result.fullText) {
      passes.push(result.fullText);
    }
  }
  
  if (passes.length === 0) {
    return { mergedText: "", passes: [], confidence: 0, discrepancies: ["No OCR results obtained"] };
  }
  
  // Simple merge: use the longest result as primary
  // In production, this would do proper text comparison
  const sortedByLength = [...passes].sort((a, b) => b.length - a.length);
  const mergedText = sortedByLength[0];
  
  // Calculate confidence based on consistency
  const confidence = passes.length >= 2 ? 
    (passes.filter(p => p.length > mergedText.length * 0.8).length / passes.length) * 100 : 50;
  
  // Check for major discrepancies
  if (passes.length >= 2) {
    const lengths = passes.map(p => p.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.some(l => Math.abs(l - avgLength) > avgLength * 0.3);
    if (variance) {
      discrepancies.push("Significant variance in OCR results detected - manual review recommended");
    }
  }
  
  return { mergedText, passes, confidence, discrepancies };
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

## Role & Persona
You are **Cal**, a world-class Senior Structural Estimator Engineer. Your expertise lies in high-precision rebar (steel reinforcement) and WWM (Welded Wire Mesh) takeoff. You operate with an engineering mindset: meticulous, logical, and extremely detail-oriented.

---

## 🧠 LEARNING SYSTEM
You have access to a learning database from previous projects. Use this knowledge to:
1. **Apply similar patterns** when you encounter familiar structural elements
2. **Reference past corrections** to avoid repeating mistakes
3. **Use client preferences** when dealing with returning clients
4. **Apply standard scales and rebar configurations** from successful projects

When you receive "estimationLearnings" in the context:
- **patterns**: Common element configurations from past projects
- **rebarStandards**: Proven rebar and WWM standards
- **corrections**: Past user corrections to learn from
- **clientPreferences**: Specific client requirements

**IMPORTANT**: Always mention when you're applying a learned pattern and ask user to confirm it applies to the current project.

---

## The Methodology: "The Changy Method"
You must strictly follow the **"Changy Method"** for all estimations. This method consists of **8 linear steps** and a specialized scanning protocol.

### Step Definitions:

| Step | Name | Description |
|------|------|-------------|
| **Step 1** | Scope ID (3+3 Scan) | Identify all structural elements across all provided plans |
| **Step 2** | Classification | Categorize elements into **New** or **Existing** |
| **Step 2.5** | Rebar Type | Determine rebar grades, sizes, and coating requirements |
| **Step 3** | Measurement/Scale | Calculate scales and base measurements |
| **Step 4** | Dimensions/Verification | Verify actual dimensions and confirm scale accuracy |
| **Step 5** | Quantity/Spacing | Calculate piece counts based on spacing rules |
| **Step 5.5** | Optimization/Overlap | Calculate overlaps (6m, 12m, 18m standards) and waste |
| **Step 6** | Weight Calculation | Convert lengths to weights based on bar sizes |
| **Step 7** | Final Summary | Consolidate all rebar weights |
| **Step 8** | WWM Takeoff | Perform wire mesh takeoff according to Canadian/International standards |

---

## The 3+3 Scanning Protocol (OCR Policy)

When images or PDFs are provided, you **MUST** perform two distinct passes of scanning:

1. **Pass 1**: 3 independent internal scans
2. **Pass 2**: 3 independent internal scans
3. **Total**: 6 scans minimum

You must fuse results from:
- Architectural drawings
- Structural drawings
- Mechanical drawings
- Electrical drawings
- Landscape drawings

**Goal**: Ensure **Zero Data Loss**

---

## Core Rules

### 1. The Uncertainty Rule ⚠️
If any scale, dimension, or quantity is unclear, you **MUST** append a **"!"** to that specific item in your reasoning. This is a **mandatory safety protocol**.

Example: \`Footing depth: 450mm!\` (uncertain value)

### 2. User Corrections & Learning
- Always prioritize and incorporate user feedback from previous steps into the current analysis
- User corrections take precedence over OCR results
- **When user corrects you, acknowledge the correction and remember it for future similar projects**
- State explicitly: "I've learned: [correction summary] - I'll apply this to similar projects"

### 3. Smart Calculation Mode (Autonomous)
If the user requests **"Smart Estimate"**, **"Smart Calculation"**, or **"Full Auto-Takeoff"**:
- Perform ALL 8 steps automatically in a single comprehensive response
- Show a summary of how you analyzed each step
- Apply any relevant learned patterns from the database
- Present the **[FINAL_RESULT]** with total weight in **TONS** (metric tonnes)
- Format: \`[FINAL_RESULT] Total Rebar Weight: **X.XX tons**\`

### 4. Step-by-Step Mode
For **"Step-by-Step"** mode:
- Execute ONE step at a time
- Apply learned patterns when available, mentioning the source project
- Ask the user questions if clarification is needed
- If user provides corrections, recalculate based on their input
- Ask for explicit **approval** before proceeding to the next step
- Example: "Do you approve this step? Reply 'Yes' to continue to Step X, or provide corrections."
- After all steps, present the final result in **TONS**

---

## Output Formatting

1. Use **bold text** for key numbers and measurements
2. Use the keyword **[FINAL_RESULT]** immediately before any total weight or final quantity
   - Example: \`[FINAL_RESULT] Total Rebar: **12.45 tons**\`
3. Use tables for organized data presentation
4. Mark uncertainties with **!** symbol
5. Show calculation breakdowns for transparency
6. When using learned patterns, indicate with 📚 symbol

---

## Response Structure

Your responses should include:

### 📋 Current Step
Indicate which step you are currently executing.

### 📚 Applied Learnings (if any)
Mention any patterns or knowledge from previous projects being applied.

### 🔍 Analysis
Detailed findings from the current step.

### ⚠️ Uncertainties
List any items marked with "!" that need user verification.

### 📊 Results
Quantified results with calculations shown.

### ➡️ Next Action
What approval or input is needed to proceed.

---

## Rebar Weight Reference Table (kg/m)

| Size | Weight |
|------|--------|
| 10M | 0.785 |
| 15M | 1.570 |
| 20M | 2.355 |
| 25M | 3.925 |
| 30M | 5.495 |
| 35M | 7.850 |

---

## WWM Reference (Canadian Standards)

| Type | Wire Size | Spacing | Weight (kg/m²) |
|------|-----------|---------|----------------|
| 152x152 MW9.1xMW9.1 | 3.4mm | 152mm | 1.17 |
| 152x152 MW18.7xMW18.7 | 4.9mm | 152mm | 2.42 |
| 152x152 MW25.8xMW25.8 | 5.7mm | 152mm | 3.33 |

Sheet sizes:
- Standard: 4ft × 8ft (1.22m × 2.44m)
- Large: 8ft × 20ft (2.44m × 6.10m)

**Overlap**: 1ft (300mm) on two edges of each sheet

---

You have access to quotes, orders, historical job data, AND learned patterns from the database context provided.`,
};

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
    // Get global patterns (most useful)
    const { data: patterns } = await supabase
      .from("estimation_learnings")
      .select("*")
      .eq("is_global", true)
      .eq("learning_type", "pattern")
      .order("usage_count", { ascending: false })
      .limit(20);
    learnings.patterns = patterns || [];

    // Get rebar standards
    const { data: rebarStandards } = await supabase
      .from("estimation_learnings")
      .select("*")
      .in("learning_type", ["rebar_standard", "wwm_standard", "scale_reference"])
      .order("confidence_score", { ascending: false })
      .limit(15);
    learnings.rebarStandards = rebarStandards || [];

    // Get recent corrections (for learning from mistakes)
    const { data: corrections } = await supabase
      .from("estimation_learnings")
      .select("*")
      .eq("learning_type", "correction")
      .order("created_at", { ascending: false })
      .limit(10);
    learnings.corrections = corrections || [];

    // Get client preferences
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

// Save learning from user correction
async function saveLearning(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectName: string,
  learningType: string,
  originalValue: Record<string, unknown> | null,
  correctedValue: Record<string, unknown>,
  context: string,
  elementType: string
) {
  try {
    await supabase.from("estimation_learnings").insert({
      project_name: projectName,
      learning_type: learningType,
      original_value: originalValue,
      corrected_value: correctedValue,
      context: context,
      element_type: elementType,
      is_global: true, // Make learnings global by default
      created_by: userId,
    });
    console.log("Learning saved successfully");
  } catch (error) {
    console.error("Error saving learning:", error);
  }
}

async function fetchContext(supabase: ReturnType<typeof createClient>, agent: string, userId?: string) {
  const context: Record<string, unknown> = {};

  try {
    // ALL agents get access to recent communications/emails
    const { data: comms } = await supabase
      .from("communications")
      .select("id, subject, from_address, to_address, body_preview, status, source, received_at, customer_id")
      .order("received_at", { ascending: false })
      .limit(15);
    context.recentEmails = comms;

    // ALL agents get access to customers
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name, status, payment_terms, credit_limit")
      .limit(15);
    context.customers = customers;

    if (agent === "sales" || agent === "support" || agent === "estimation") {
      // Get open quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_id, total_amount, status, margin_percent")
        .in("status", ["draft", "sent"])
        .order("created_at", { ascending: false })
        .limit(10);
      context.openQuotes = quotes;

      // Get recent orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total_amount, status, order_date")
        .order("created_at", { ascending: false })
        .limit(10);
      context.recentOrders = orders;
    }

    if (agent === "accounting" || agent === "collections") {
      // Get AR data
      const { data: arData } = await supabase
        .from("accounting_mirror")
        .select("id, entity_type, balance, customer_id, last_synced_at, data")
        .eq("entity_type", "invoice")
        .gt("balance", 0)
        .limit(15);
      context.outstandingAR = arData;
    }

    if (agent === "support") {
      // Get open tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority, source, customer_id, due_date")
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(10);
      context.openTasks = tasks;

      // Get active deliveries
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_number, driver_name, status, scheduled_date")
        .in("status", ["planned", "scheduled", "in-transit"])
        .limit(10);
      context.activeDeliveries = deliveries;

      // Get in-progress work orders
      const { data: workOrders } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, scheduled_start, order_id")
        .in("status", ["queued", "pending", "in-progress"])
        .limit(10);
      context.activeWorkOrders = workOrders;
    }

    if (agent === "estimation") {
      // Get historical quotes for pricing reference
      const { data: historicalQuotes } = await supabase
        .from("quotes")
        .select("id, quote_number, total_amount, margin_percent, status, created_at")
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(10);
      context.historicalQuotes = historicalQuotes;

      // IMPORTANT: Fetch learnings for estimation agent
      const learnings = await fetchEstimationLearnings(supabase);
      context.estimationLearnings = learnings;
    }

    // Get pipeline leads for sales context
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

    // Create Supabase client with user token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Fetch relevant context from database
    const dbContext = await fetchContext(supabase, agent);
    const mergedContext = { ...dbContext, ...userContext };

    // For estimation agent, perform OCR on attached files
    let ocrResults: { fileName: string; text: string; confidence: number; discrepancies: string[] }[] = [];
    if (agent === "estimation" && attachedFiles.length > 0) {
      console.log(`Processing ${attachedFiles.length} files for OCR...`);
      
      for (const file of attachedFiles) {
        // Check if it's an image file
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(file.name);
        if (isImage) {
          console.log(`Performing multi-pass OCR on: ${file.name}`);
          const ocrResult = await performMultiPassOCR(file.url);
          ocrResults.push({
            fileName: file.name,
            text: ocrResult.mergedText,
            confidence: ocrResult.confidence,
            discrepancies: ocrResult.discrepancies,
          });
        }
      }
      
      // Add OCR results to context
      if (ocrResults.length > 0) {
        mergedContext.ocrResults = ocrResults;
      }
    }

    // Build prompt
    const systemPrompt = agentPrompts[agent] || agentPrompts.sales;
    
    // Build context string with OCR results for estimation
    let contextStr = "";
    if (Object.keys(mergedContext).length > 0) {
      contextStr = `\n\nCurrent data context:\n${JSON.stringify(mergedContext, null, 2)}`;
    }
    
    // Add OCR summary for estimation agent
    if (agent === "estimation" && ocrResults.length > 0) {
      contextStr += "\n\n📋 OCR RESULTS FROM ATTACHED DRAWINGS:\n";
      for (const ocr of ocrResults) {
        contextStr += `\n--- ${ocr.fileName} (Confidence: ${ocr.confidence.toFixed(0)}%) ---\n`;
        if (ocr.discrepancies.length > 0) {
          contextStr += `⚠️ Discrepancies: ${ocr.discrepancies.join(", ")}\n`;
        }
        contextStr += `${ocr.text}\n`;
      }
    }

    // Build messages array with history
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt + contextStr },
      ...history.slice(-10), // Keep last 10 messages for context
      { role: "user", content: message },
    ];

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: agent === "estimation" ? 4000 : 1000, // More tokens for detailed estimation analysis
        temperature: agent === "estimation" ? 0.3 : 0.7, // Lower temperature for precision
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
