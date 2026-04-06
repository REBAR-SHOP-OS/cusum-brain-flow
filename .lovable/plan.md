

# بهبود هوشمندی زمانی ویزی و یکپارچگی مغز با داده واقعی

## مشکلات فعلی

1. **زمان**: ویزی فقط هنگام شروع session زمان را دریافت می‌کند و در طول مکالمه آپدیت نمی‌شود
2. **مغز**: دکمه "Analyze Now" فقط با دستور دستی اجرا می‌شود — داده‌ها ممکن است کهنه باشند
3. **صوتی**: ویزی از pre-digest استفاده می‌کند ولی Brain knowledge فقط ۵۰ مورد آخر را load می‌کند و ممکن است اطلاعات ذخیره‌شده در مغز را هنگام پاسخ‌دهی نادیده بگیرد

## تغییرات

### 1. تزریق زمان زنده در system prompt صوتی
**فایل:** `src/hooks/useVizzyVoiceEngine.ts`

در `buildInstructions` یک خط اضافه شود که به ویزی بگوید همیشه زمان واقعی را از system context بخواند و هر بار که سوال زمانی پرسیده شود، زمان فعلی را بداند:

```
═══ REAL-TIME CLOCK (CRITICAL) ═══
You MUST know the current time at all times. The session started at [formattedNow].
For time-sensitive questions, calculate the current time by adding elapsed conversation time to the start time.
When asked "what time is it?" — provide the CURRENT time in [timezone], not the session start time.
```

همچنین هنگام refresh session (خط ~452)، timestamp دقیق‌تر ساخته شود.

### 2. تزریق Brain Knowledge در context صوتی
**فایل:** `supabase/functions/vizzy-pre-digest/index.ts`

در حال حاضر `vizzy-pre-digest` از `buildFullVizzyContext` استفاده می‌کند که knowledge جدول را load می‌کند. اما `vizzy_memory` (مغز ویزی) جداگانه است. باید یک بخش اضافه شود که آخرین ۳۰ مورد از `vizzy_memory` را هم load کند و به عنوان بخش `═══ BRAIN MEMORY ═══` به raw context اضافه کند تا AI هنگام pre-digest آن‌ها را هم تحلیل کند.

```typescript
// Load Brain memories for context
const { data: brainMemories } = await supabase
  .from("vizzy_memory")
  .select("category, content, created_at")
  .eq("user_id", userId)
  .not("category", "in", "(daily_benchmark,timeclock)")
  .order("created_at", { ascending: false })
  .limit(30);

const brainBlock = (brainMemories || [])
  .map(m => `[${m.category}] ${m.content}`)
  .join("\n");
```

سپس این `brainBlock` به prompt AI اضافه شود.

### 3. Auto-refresh مغز هنگام شروع voice session
**فایل:** `src/hooks/useVizzyVoiceEngine.ts`

در حال حاضر `startSession` فقط `vizzy-pre-digest` را صدا می‌زند. باید قبل از آن (یا به صورت موازی) `analyzeSystem` را هم trigger کند تا مغز با آخرین داده‌ها بروز شود. **اما** چون analyze کند است و voice session نباید منتظر بماند، این کار باید fire-and-forget باشد.

بهتر است: از آنجا که `vizzy-pre-digest` خودش از `buildFullVizzyContext` استفاده می‌کند و کل داده‌های سیستم را دارد، نیازی به analyze جداگانه نیست. فقط کافی است brain memories در pre-digest inject شوند (مرحله ۲).

### 4. دستور مغز به ویزی: همیشه از brain استفاده کن
**فایل:** `src/hooks/useVizzyVoiceEngine.ts`

در `VIZZY_INSTRUCTIONS` یک بخش جدید اضافه شود:

```
═══ BRAIN MEMORY (ALWAYS USE) ═══
Your BRAIN contains saved insights, corrections, and learned facts from previous sessions.
When answering ANY question, ALWAYS cross-reference your Brain Memory section below.
Brain memories are the CEO's verified corrections and your own learned insights — they take PRIORITY over raw data when there's a conflict.
```

### 5. بروز بودن خودکار مغز (Watchdog integration)
**فایل:** `supabase/functions/vizzy-business-watchdog/index.ts` (بدون تغییر کد — از قبل هر ۱۵ دقیقه اجرا می‌شود)

در حال حاضر watchdog فقط notification می‌سازد. باید یک بخش اضافه شود که findings مهم را به `vizzy_memory` هم بنویسد تا مغز همیشه بروز باشد.

## خلاصه تغییرات

| فایل | تغییر |
|------|-------|
| `src/hooks/useVizzyVoiceEngine.ts` | اضافه کردن بخش REAL-TIME CLOCK و BRAIN MEMORY به instructions |
| `supabase/functions/vizzy-pre-digest/index.ts` | Load و inject کردن vizzy_memory entries در context |
| `supabase/functions/vizzy-business-watchdog/index.ts` | ذخیره findings مهم در vizzy_memory |

## نتیجه
- ویزی همیشه زمان دقیق را می‌داند
- ویزی در voice chat همیشه از مغز (brain memories) استفاده می‌کند
- مغز هر ۱۵ دقیقه توسط watchdog با داده‌های واقعی بروز می‌شود
- هیچ اطلاعاتی از دست نمی‌رود

