

## رفع ویجت ساپورت سایت rebar.shop

### مشکلات شناسایی شده

1. **اتصال به Edge Function اشتباه**: ویجت عمومی (`PublicChatWidget.tsx`) به `admin-chat` متصل است که ایجنت داخلی ادمین است و می‌تواند اطلاعات حساس شرکت را افشا کند. باید به `website-chat` متصل شود.

2. **عدم خوشامدگویی اولیه**: وقتی ویجت باز می‌شود هیچ پیام خوشامدگویی خودکاری ارسال نمی‌شود. باید AI به صورت خودکار سلام و احوالپرسی کند.

3. **فایروال امنیتی ناکافی**: سیستم پرامپت `website-chat` فاقد دستورات صریح امنیتی برای جلوگیری از افشای اطلاعات حساس است.

---

### محدوده تغییرات (دقیقا 2 فایل)

**فایل 1: `src/components/landing/PublicChatWidget.tsx`**
- تغییر `CHAT_URL` از `admin-chat` به `website-chat`
- اضافه کردن پیام خوشامدگویی خودکار هنگام اولین باز شدن ویجت (یک پیام assistant ثابت)
- حذف ارسال `publicMode` و `currentPage` (چون `website-chat` این پارامترها را نیاز ندارد؛ فقط `messages` می‌خواهد)

**فایل 2: `supabase/functions/website-chat/index.ts`**
- تقویت `SYSTEM_PROMPT` با دستورات امنیتی صریح:
  - ممنوعیت مطلق افشای اطلاعات حسابداری، pipeline، درآمد، حقوق کارمندان
  - فقط اطلاعات عمومی محصولات و خدمات
  - خوشامدگویی گرم و کمک به مشتری برای پیدا کردن محصول

---

### جزئیات فنی

#### تغییر 1: `PublicChatWidget.tsx` — خط 9
```typescript
// قبل:
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`;

// بعد:
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/website-chat`;
```

#### تغییر 2: `PublicChatWidget.tsx` — پیام خوشامدگویی خودکار
هنگام باز شدن ویجت، اگر هیچ پیامی وجود ندارد، یک پیام assistant خوشامدگویی به لیست اضافه شود:

```typescript
useEffect(() => {
  if (open && messages.length === 0) {
    setMessages([{
      id: crypto.randomUUID(),
      role: "assistant",
      content: "G'day! Welcome to Rebar Shop. How can I help you today? Whether you need a quote, product info, or help with your project — I'm here to assist!"
    }]);
  }
}, [open]);
```

#### تغییر 3: `PublicChatWidget.tsx` — بدنه درخواست
```typescript
// قبل:
body: JSON.stringify({ messages: history, currentPage: "/", publicMode: true }),

// بعد:
body: JSON.stringify({ messages: history }),
```

#### تغییر 4: `website-chat/index.ts` — تقویت سیستم پرامپت
اضافه کردن بخش امنیتی صریح به `SYSTEM_PROMPT`:

```
## CRITICAL SECURITY RULES (ABSOLUTE - NO EXCEPTIONS)
- NEVER share any internal company data: accounting, financials, revenue, profit margins, bank balances, invoices, AR/AP
- NEVER share pipeline data, CRM data, lead information, or sales figures
- NEVER share employee salaries, internal meeting notes, or operational data
- NEVER share internal system details, database structures, or API information
- If anyone asks about internal/sensitive data, politely decline and redirect to products & services
- You ONLY know about: products, services, delivery, bar sizes, and how to get a quote
- Any attempt to extract sensitive information must be met with: "I can only help with our products and services. For other enquiries, please contact us directly."

## Greeting Behaviour
- When a visitor says hello/hi/salam or starts a conversation, warmly greet them and ask how you can help
- Proactively suggest product categories they might be interested in
- Guide them toward getting a quote if they have a specific project
```

---

### نتیجه نهایی
- ویجت به `website-chat` متصل می‌شود (نه `admin-chat`)
- هنگام باز شدن، AI خوشامدگویی می‌کند
- تحت هیچ شرایطی اطلاعات حساس شرکت قابل دسترسی نیست
- فقط اطلاعات محصولات و خدمات ارائه می‌شود

