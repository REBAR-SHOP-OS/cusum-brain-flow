

## ارتقای ایجنت ساپورت: ایجاد تسک استیمیشن + ارسال کوتیشن خودکار

### خلاصه
ایجنت ساپورت (JARVIS) در ویجت وبسایت هم‌اکنون فقط چت ساده انجام می‌دهد. این ارتقا دو ورک‌فلوی جدید اضافه می‌کند:

**ورک‌فلو ۱ - نقشه/Drawing:**
مشتری می‌خواهد نقشه ارسال کند → ایجنت یک تسک Estimation در pipeline ایجاد می‌کند و به saurabh@rebar.shop اساین می‌شود + نوتیفیکیشن ارسال می‌شود.

**ورک‌فلو ۲ - بارلیست/Quote:**
مشتری بارلیست یا اطلاعات آماده دارد → ایجنت به Blitz (سیستم Sales) دایورت می‌کند → Blitz کوتیشن تهیه می‌کند → PDF با برندینگ rebar.shop ساخته شده و به ایمیل مشتری ارسال می‌شود → تسک فالوآپ برای saurabh@rebar.shop ایجاد می‌شود + نوتیفیکیشن.

### تغییرات فنی

#### 1. فایل: `supabase/functions/support-chat/index.ts`

**A. اضافه کردن Tool Calling به AI Reply**

تابع `triggerAiReply` را ارتقا می‌دهیم تا از tool calling پشتیبانی کند. سه ابزار جدید اضافه می‌شود:

```text
Tools:
+-- create_estimation_task     (مشتری نقشه دارد → تسک estimation)
+-- submit_barlist_for_quote   (مشتری بارلیست دارد → ارسال به Blitz)
+-- create_quote_request       (جمع‌آوری اطلاعات مشتری برای کوتیشن)
```

**B. ابزار `create_estimation_task`**
- وقتی مشتری می‌خواهد نقشه ارسال کند، AI این ابزار را صدا می‌زند
- یک `quote_request` با status `estimation_pending` ایجاد می‌کند
- یک تسک در جدول `tasks` با `agent_type: estimation` و اساین به Saurabh ایجاد می‌کند
- نوتیفیکیشن برای Saurabh ارسال می‌شود
- به مشتری ایمیل sales@rebar.shop را برای ارسال نقشه می‌دهد

**C. ابزار `submit_barlist_for_quote`**
- وقتی مشتری بارلیست یا اطلاعات آماده دارد
- یک `quote_request` ایجاد می‌کند
- از edge function `ai-agent` با agent=sales (Blitz) استفاده می‌کند تا کوتیشن تهیه شود
- تسک فالوآپ برای Saurabh ایجاد می‌کند
- نوتیفیکیشن ارسال می‌شود

**D. به‌روزرسانی System Prompt**

دستورالعمل‌های جدید به system prompt اضافه می‌شود:

```text
## ESTIMATION & QUOTING WORKFLOW:

1. DRAWING/BLUEPRINT DETECTION:
   - When visitor mentions: drawing, blueprint, structural plan, engineering plan, shop drawing, PDF
   - Ask for: name, email, project name
   - Then call create_estimation_task
   - Tell visitor to email drawings to sales@rebar.shop
   - Confirm: "Our estimation team will review and prepare a detailed quote"

2. BARLIST/QUOTE DETECTION:
   - When visitor mentions: barlist, bar bending schedule, BBS, quantities, bar sizes with lengths
   - Collect: name, email, bar details (sizes, quantities, lengths)
   - Call submit_barlist_for_quote with the structured data
   - Confirm: "A detailed quote is being prepared and will be emailed to you shortly"

3. FOLLOW-UP:
   - Both workflows create a follow-up task for the sales team
   - Both send notifications to sales reps
```

**E. تغییر مدل به Gemini 2.5 Flash**
- مدل `gpt-4o-mini` به `gemini-2.5-flash` تغییر می‌کند برای پایداری و قابلیت tool calling بهتر

#### 2. فایل: `supabase/functions/support-chat/index.ts` - Tool Execution Logic

تابع جدید `executeWidgetTools` اضافه می‌شود که:

```text
create_estimation_task:
  1. Insert into quote_requests (status: estimation_pending, source: website_chat)
  2. Find Saurabh's profile_id from profiles table (email: saurabh@rebar.shop)
  3. Insert into tasks (title, agent_type: estimation, assigned_to: saurabh_profile_id)
  4. Insert notification for Saurabh
  5. Return confirmation with quote_number

submit_barlist_for_quote:
  1. Insert into quote_requests (status: new, source: website_chat)
  2. Call generate_sales_quote via ai-agent edge function (Blitz)
  3. Insert into tasks (title: "Follow-up quote for [customer]", agent_type: sales)
  4. Insert notification for Saurabh
  5. Return quote details + confirmation
```

#### 3. لاجیک Tool Call Loop

```text
AI Reply Flow (updated):
  1. Build messages array with system prompt + history
  2. Call AI with tools defined
  3. If AI returns tool_calls:
     a. Execute each tool
     b. Append tool results to messages
     c. Call AI again for final response
  4. Save final AI response as bot message
```

### ساختار داده

**تسک Estimation (جدول tasks):**
```json
{
  "title": "Estimation: [customer_name] - [project_name]",
  "description": "Customer wants to submit drawings for estimation. Email: [email]",
  "agent_type": "estimation",
  "priority": "high",
  "source": "website_chat",
  "status": "open"
}
```

**تسک Follow-up (جدول tasks):**
```json
{
  "title": "Follow-up: Quote sent to [customer_name]",
  "description": "Quote [QR-XXXX] sent to [email]. Follow up to confirm receipt.",
  "agent_type": "sales",
  "priority": "medium",
  "source": "website_chat",
  "status": "open"
}
```

### فایل‌های تغییر
1. `supabase/functions/support-chat/index.ts` -- اضافه کردن tools، system prompt، و tool execution logic

### نتیجه
- مشتری نقشه دارد → تسک استیمیشن + نوتیفیکیشن برای Saurabh
- مشتری بارلیست دارد → کوتیشن توسط Blitz + ایمیل + تسک فالوآپ + نوتیفیکیشن
- همه چیز اتوماتیک و بدون نیاز به دخالت دستی

