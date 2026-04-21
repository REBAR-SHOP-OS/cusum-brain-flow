

# Edge Functions Explorer — کاوشگر فانکشن‌ها روی صفحهٔ Architecture

یک آیکون جدید کنار دکمهٔ Fullscreen در صفحهٔ `/architecture` اضافه می‌کنم. با کلیک، یک پنل تمام‌صفحه باز می‌شود که همهٔ ۲۰۰+ Edge Function را به‌صورت کارت نمایش می‌دهد. کلیک روی هر کارت اتصالات آن فانکشن را نشان می‌دهد.

## آیکون و محل قرارگیری

- آیکون: `Boxes` از `lucide-react` (یا `Network`) داخل دایرهٔ کوچک سایان‌رنگ.
- محل: گوشهٔ بالا-چپ canvas، **کنار دکمهٔ Fullscreen** (همان جای دایرهٔ قرمزی که کشیدی).
- Tooltip: «Edge Functions Explorer».

## فایل‌های جدید

### ۱. `src/lib/edgeFunctionsRegistry.ts`
- آرایهٔ ثابت با نام تمام ۲۰۰+ فانکشن (از روی پوشهٔ `supabase/functions/`).
- دسته‌بندی خودکار با prefix:
  - `ai-*`, `vizzy-*`, `seo-*`, `ringcentral-*`, `gmail-*`, `qb-*`, `odoo-*`, `stripe-*`, `face-*`, `social-*`, `wp-*`, `website-*`, `pipeline-*`, `elevenlabs-*`, `camera-*`, `wincher-*` → category خودکار
  - بقیه → "General"
- هر فانکشن: `{ name, category, accent }`

### ۲. `src/lib/edgeFunctionConnections.ts`
- helper که runtime با grep ساده روی فایل‌های frontend اتصالات هر فانکشن را پیدا می‌کند.
- چون نمی‌توانیم در runtime به فایل‌سیستم بزنیم، یک **manifest استاتیک** می‌سازم:
  - برای هر فانکشن، لیست caller هایش از frontend (آن جاهایی که `supabase.functions.invoke("function-name")` صدا زده شده).
  - با اسکن در زمان build/تولید plan جمع می‌آوریم و در یک object بزرگ ذخیره می‌کنیم: `Record<functionName, { callers: string[], crons?: boolean }>`.

### ۳. `src/components/system-flow/EdgeFunctionsPanel.tsx`
- Sheet/Dialog تمام‌صفحه (با `Sheet` از shadcn، side="right", w-full md:w-[900px]).
- Header: "Edge Functions" + شمارنده + Search box + فیلتر دسته‌بندی (chips).
- Body: grid کارت‌ها (4 ستون desktop / 2 موبایل):
  ```
  ┌──────────────┐
  │ 🤖 ai-extract│
  │ AI / Extract │
  │ 3 callers    │
  └──────────────┘
  ```
- کارت رنگ accent مطابق دسته دارد (cyan/violet/orange…).
- کلیک روی کارت → `EdgeFunctionDetailDialog` باز می‌شود.

### ۴. `src/components/system-flow/EdgeFunctionDetailDialog.tsx`
نمایش جزئیات اتصال هر فانکشن:
- نام + دسته + رنگ accent.
- بخش **Frontend Callers**: لیست فایل‌های `.tsx/.ts` که این فانکشن را invoke می‌کنند (با مسیر).
- بخش **Triggers**: cron / webhook / manual (از manifest).
- بخش **Related Functions**: فانکشن‌های هم‌دسته (مثلاً `vizzy-*` همه با هم).
- دکمهٔ "View Logs" که به Supabase logs لینک می‌دهد (read-only، اگر URL در دست باشد).

## تغییرات روی فایل موجود

### `src/pages/Architecture.tsx`
- Import: `Boxes` از lucide، `EdgeFunctionsPanel` جدید.
- state: `const [showFunctionsPanel, setShowFunctionsPanel] = useState(false);`
- در بلوک `top-2 left-2` (همان‌جای دکمهٔ Fullscreen، خط ~۷۵۸–۷۶۷) یک دکمهٔ دوم اضافه می‌شود کنار آن:
  ```tsx
  <button onClick={() => setShowFunctionsPanel(true)} ...>
    <Boxes /> Functions
  </button>
  ```
- در انتهای JSX، رندر `<EdgeFunctionsPanel open={showFunctionsPanel} onOpenChange={setShowFunctionsPanel} />`.

## آنچه دست نمی‌خورد

- ساختار ReactFlow، nodes، edges، layers و dialog فعلی Architecture.
- هیچ Edge Function، schema، RLS یا storage.
- بقیهٔ صفحات و کامپوننت‌ها.

## اعتبارسنجی

1. ورود به `/architecture` → کنار دکمهٔ Fullscreen آیکون جدید "Functions" دیده شود.
2. کلیک → پنل با ۲۰۰+ کارت باز شود، Search و فیلتر دسته‌بندی کار کند.
3. کلیک روی هر کارت → جزئیات اتصالات (callers + triggers) نمایش داده شود.
4. هیچ خطای console نباشد.

