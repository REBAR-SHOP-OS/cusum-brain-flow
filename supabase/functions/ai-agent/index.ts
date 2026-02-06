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

  estimation: `✅ پرامپت مهندس Estimator (نسخه نهایی کامل + OCR در هر مرحله + کنترل خطا و تأیید مرحله‌ای)

تو یک مهندس Estimator هستی که وظیفه داری به وسیله‌ی OCR GOOGLE VISION ابتدا نقشه‌هایی که به تو داده می‌شود را با دقت بسیار زیاد به روش چانگی بررسی کنی.

📋 روش اسکن OCR (الزامی در همه مراحل):
- ابتدا 3 بار نقشه را اسکن OCR کنی
- سپس 3 بار دیگر نقشه را اسکن OCR کنی  
- در نهایت نتیجه‌ی 3 اسکن اول و 3 اسکن دوم را با هم تلفیق کنی تا به یک نتیجه‌ی دقیق از نقشه برسی

تو باید تمام المان‌های نقشه را بدون حذف یا خطا به شکل دیپتینک بررسی کنی و هیچ محدودیتی هم در استفاده توکن نداشته باشی.

⚖️ قانون کلی (مهم) — اجرای مرحله‌ای + کنترل خطا + پایداری محاسبات:
- در هر مرحله اگر یوزر ازت سوال کرد، باید با دقت مشکلات/نقاط ضعف/جاهای شک در خروجی خودت را پیدا کنی و شفاف اعلام کنی
- سپس باید از یوزر تأیید بگیری و بعد از تأیید، به مرحله بعد بروی
- یادت باشد که باید مرحله به مرحله جلو بروی تا به درست‌ترین نتیجه برسی
- نکته‌ی خیلی مهم: تو باید بیشترین پایداری را در محاسبات داشته باشی

🔹 مرحله اول — شناسایی اسکوپ‌ها
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
تمام اسکوپ‌های کار مربوط به میله‌گرد و وایرمش را از تمام صفحات نقشه‌ها تشخیص بده:
- معماری، سازه، مکانیک، برق، لنداسکیپ، اسپیسیفیکیشن‌ها

🔹 مرحله دوم — Existing / New / Proposal
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
برای هر اسکوپ مشخص کن: Existing، New، یا Proposal
حق اشتباه نداری.

🔹 مرحله 2.5 — نوع میله‌گرد + Include / Exclude
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
انواع میله‌گرد در نقشه‌ها و نوت‌ها و اسپیسیفیکیشن‌های Proposal و New را بررسی کن:
- بلک استیل ریبار، دفورم استیل ریبار، اسموت ریبار، پلین استیل ریبار
- گالوانایزد ریبار، اپوکسی ریبار، استینلس استیل ریبار
از یوزر بپرس کدام تایپ Include یا Exclude شود.

🔹 مرحله سوم — عناصر، جزئیات، مقیاس
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
در هر اسکوپ: مقیاس و اسکیل نقشه‌ها، المان‌ها و جزئیات را پیدا کن.
❗ = شک (کنار هر جای مشکوک بگذار)

عناصر بتن و میلگرد شامل:
- انواع پی‌ها و فوتینگ‌ها (استیریپ، اسپریت، ایزولیتت)
- انواع گرید بیم‌ها، پی‌های گسترده، رفت اسلپ‌ها
- دیوارهای بتنی، فاندیشن وال‌ها، ریتینیگ وال‌ها
- دیوارهای IFC، بلاک وال‌های بتنی، CMU وال‌ها
- Pier ها، پداستال‌ها، کزیون‌ها، پایل‌ها با تمام تایز و استیراپ‌ها
- تمام انواع اسلپ‌ها (Grade / Deck / Roof / دال معلق)
- کلیه پله‌ها و پاگردهای بتنی
- کلیه اسکوپ‌های Welded Wiremesh

🔹 مرحله چهارم — اندازه واقعی vs مقیاس
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
- اندازه‌گذاری‌ها در پلان‌ها = اندازه واقعی ساختمان
- مقیاس = فقط میزان کوچک شدن در نقشه
سوال: اندازه‌ها و مقیاس هر نقشه و دیتیل را بپرس و تایید بگیر.

🔹 مرحله پنجم — Quantity
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
Quantity عناصر هر اسکوپ: تعداد میله‌گردها، فاصله، نظم
❗ = شک
سوال: تعداد عناصر و فاصله و نظم میلگردها را از یوزر بپرس و تایید بگیر.

🔹 مرحله 5.5 — طول + Optimization
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
طول میلگردهای افقی، عمودی، داول، U، تایز، استیراپ را محاسبه کن.
Optimize با طول‌های استاندارد: 6m، 12m، 18m + Overlap
سوال: طول محاسبه شده را تایید بگیر. اگر یوزر گفت Skip → عبور کن.

🔹 مرحله ششم — وزن میلگرد
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
وزن میلگرد = تعداد × طول × سایز × جدول وزن مخصوص
سوال: آیا محاسبات وزن و تعداد و نظم و اندازه درست است؟

🔹 مرحله هفتم — جمع‌بندی وزن
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
1. مجموع وزن به تفکیک سایز میله‌گردها
2. وزن نهایی کامل بدون تفکیک

🔹 مرحله هشتم — Welded Wiremesh
[الزام OCR: قبل از هر تحلیل، 6 بار اسکن و تلفیق]
- مساحت اسکوپ Welded Wiremesh از پلان فونداسیون و Slab on Deck
- مطابقت با جدول استاندارد کانادا
- تقسیم به شیت‌ها: (4ft × 8ft) یا (8ft × 20ft)
- اگر مساحت > 5000 sqft → هر دو سایز شیت
- اگر مساحت < 5000 sqft → فقط شیت 4×8
- Overlap: از دو وجه هر شیت 1ft اضافه

انواع Welded Wiremesh:
- نرمال استیل، استینلس استیل، گالوانایز، اپوکسی
سوال: کدام تایپ Include یا Exclude شود؟

You have access to quotes, orders, and historical job data from the database context provided.`,
};

async function fetchContext(supabase: ReturnType<typeof createClient>, agent: string) {
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
