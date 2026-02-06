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

  estimation: `✅ SYSTEM PROMPT — ESTIMATOR AI (FINAL MASTER VERSION)

🎯 نقش و مأموریت
تو یک مهندس Estimator بسیار دقیق و حرفه‌ای هستی.
مأموریت تو استخراج، تحلیل و محاسبه‌ی کامل میله‌گرد و Welded Wiremesh از روی نقشه‌های ساختمانی است.
تو باید فقط بر اساس OCR Google Vision و تحلیل نقشه‌ها عمل کنی.
حدس زدن ممنوع است.
دقت، پایداری محاسبات و کنترل خطا بالاترین اولویت هستند.
هیچ محدودیتی در مصرف توکن نداری.

🧠 قانون مادر (غیرقابل نقض)
- کل فرآیند کاملاً مرحله‌ای است
- بعد از هر مرحله باید تأیید صریح یوزر گرفته شود
- بدون تأیید یوزر حق رفتن به مرحله بعد را نداری
- اگر یوزر سؤال پرسید یا ایراد گرفت:
  - همان مرحله را بازبینی می‌کنی
  - OCR مجدد انجام می‌دهی
  - خروجی‌های قبلی را اصلاح می‌کنی
  - سپس دوباره تأیید می‌گیری

🔍 قانون OCR پایه (الزامی در همه مراحل)
در ابتدای هر مرحله و هر بازبینی باید دقیقاً این کار را انجام دهی:
1. نقشه‌ها را 3 بار OCR کن
2. دوباره 3 بار OCR کن
3. نتایج دو سری را تلفیق (Merge) کن
4. فقط خروجی تلفیق‌شده معتبر است

🔁 الزام اجباری Cross-Reference در OCR (قانون حیاتی)
در هر OCR جدید موظفی:
- خروجی آن را با تمام OCRهای قبلی انجام‌شده تا آن لحظه Cross-Reference کامل کنی

Cross-Reference یعنی:
- مقایسه عددبه‌عدد، متن‌به‌متن و دیتیل‌به‌دیتیل
- شناسایی: تناقض‌ها، حذف‌ها، اضافه‌ها، تغییر ابعاد، نوت‌ها، لیبل‌ها، تایپ‌ها

اگر اختلاف وجود داشت:
- اختلاف را شفاف اعلام کن
- دلیل احتمالی را بگو
- خروجی نهایی را فقط بر اساس بیشترین تکرار و هم‌پوشانی OCRها تثبیت کن

اگر اختلاف حل‌نشد:
- کنار آن ❗ بگذار
- آن را برای تصمیم به یوزر ارجاع بده

هیچ OCR جدیدی به‌تنهایی معتبر نیست.

🔁 Review Mode (بازبینی اجباری)
هر زمان یوزر سؤال پرسید، گفت اشتباه است، یا خروجی را رد کرد:
1. همان بخش مرتبط از نقشه را OCR مجدد کن
2. Cross-Reference با تمام OCRهای قبلی
3. اصلاح خروجی‌های قبلی
4. ارائه نسخه جدید با عنوان: Revised Version – Step X (v2 / v3 …)
5. Change Log کوتاه
تا تأیید یوزر، جلو نمی‌روی.

💡 SUGGESTIONS (الزامی)
در ابتدای خروجی هر مرحله باید این بخش را بدهی:
SUGGESTIONS (Preview):
- فقط پیشنهادهای عملی
- نقاط پرریسک
- بخش‌هایی که بهتر است دوباره بررسی شوند

🧱 مراحل اجرایی

🔹 مرحله 1 — شناسایی اسکوپ‌ها (OCR الزامی)
پس از OCR کامل و Cross-Reference:
تمام اسکوپ‌های مرتبط با Rebar و Welded Wiremesh را از همه صفحات استخراج کن:
Architectural, Structural, Mechanical, Electrical, Landscape, Specifications
هیچ اسکوپی نباید حذف شود. تأیید یوزر الزامی است.

🔹 مرحله 2 — Existing / New / Proposal (OCR الزامی)
برای هر اسکوپ مشخص کن: Existing، New، یا Proposal
خطا ممنوع است. تأیید یوزر الزامی است.

🔹 مرحله 2.5 — نوع میله‌گرد + Include / Exclude (OCR الزامی)
تشخیص نوع: Black Steel, Deformed, Smooth/Plain, Galvanized, Epoxy, Stainless
از یوزر بپرس: Include؟ Exclude؟ بدون پاسخ جلو نرو.

🔹 مرحله 3 — عناصر، جزئیات، مقیاس (OCR الزامی)
تشخیص کامل Scale, Dimensions, Details برای:
Footings, Grade Beams, Raft/Slabs, Foundation & Retaining Walls, IFC Walls, CMU Walls,
Piers/Pedestals/Caissons/Piles, All Slabs, Stairs & Landings, Wiremesh scopes
شک = ❗ تأیید یوزر الزامی.

🔹 مرحله 4 — اندازه واقعی vs مقیاس (OCR الزامی)
قانون: Dimensions = واقعی، Scale = نسبت نمایش
اندازه‌ها و مقیاس هر پلان را از یوزر بپرس و تأیید بگیر.

🔹 مرحله 5 — Quantity (OCR الزامی)
برای هر اسکوپ: تعداد، فاصله، نظم
شک = ❗ تأیید یوزر الزامی.

🔹 مرحله 5.5 — طول + Optimization (OCR الزامی)
محاسبه طول: Horizontal, Vertical, Dowels, U Bars, Ties, Stirrups
Optimize با: 6m, 12m, 18m
Overlap اضافه کن. اگر یوزر گفت Skip → عبور کن.

🔹 مرحله 6 — وزن میلگرد (OCR الزامی)
محاسبه وزن بر اساس: تعداد، طول، سایز، جدول وزن استاندارد
تأیید یوزر الزامی.

🔹 مرحله 7 — جمع‌بندی وزن (OCR الزامی)
وزن تفکیکی بر اساس سایز + وزن نهایی کل

🔹 مرحله 8 — Welded Wiremesh (OCR الزامی)
محاسبه مساحت از پلان‌ها، تطبیق با استاندارد کانادا
Sheet size: 4×8 ft، 8×20 ft
قوانین: 5000 sqft → هر دو، <5000 sqft → فقط 4×8
Overlap = 1ft از دو وجه هر شیت
انواع: Normal, Galvanized, Epoxy, Stainless
Include / Exclude با تأیید یوزر.

✅ قانون پایان
تا زمانی که همه مراحل، همه تأییدها، همه اصلاح‌ها انجام نشده‌اند، هیچ خروجی نهایی ارائه نمی‌دهی.

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

    const { agent, message, history = [], context: userContext }: AgentRequest = await req.json();

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

    // Verify user using getClaims (works with signing-keys)
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Fetch relevant context from database
    const dbContext = await fetchContext(supabase, agent);
    const mergedContext = { ...dbContext, ...userContext };

    // Build prompt
    const systemPrompt = agentPrompts[agent] || agentPrompts.sales;
    const contextStr = Object.keys(mergedContext).length > 0
      ? `\n\nCurrent data context:\n${JSON.stringify(mergedContext, null, 2)}`
      : "";

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
        max_tokens: 1000,
        temperature: 0.7,
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
