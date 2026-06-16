
## مشکل
در `supabase/functions/social-publish/index.ts` (خط ~۱۷۵)، آستانه‌ی stale-lock روی **۱۰ دقیقه** ست شده. در سناریوی واقعی این پروژه (publish لحظه‌ای، چندین page، شکست به‌علت توکن Meta) پست برای دقایق طولانی در `status='publishing'` گیر می‌کند و کاربر فقط با retry به 409 می‌خورد.

علاوه بر این، حالت‌هایی هست که `publishing_started_at` نال است ولی `status='publishing'` (lock یتیم واقعی) و کد فعلی این را stale در نظر نمی‌گیرد — `ageMs = Number.MAX_SAFE_INTEGER` که > STALE_MS است، پس عملاً آزاد می‌شود، ولی فقط اگر مسیر `if (ageMs > STALE_MS)` صحیح اجرا شود (الان اجرا می‌شود — این بخش OK است).

تنها تغییر لازم: کاهش پنجره stale از **۱۰ دقیقه به ۲ دقیقه**. یک Meta publish واقعی معمولاً زیر ۶۰ ثانیه تمام می‌شود و social-cron هم در همان بازه‌ی کوتاه پشت سر هم اجرا نمی‌شود، پس ۲ دقیقه ایمن است و double-publish تولید نمی‌کند.

## تغییرات

### 1. `supabase/functions/social-publish/index.ts`
- خط ۱۷۵: `const STALE_MS = 10 * 60 * 1000;` → `const STALE_MS = 2 * 60 * 1000;`
- log را همین‌طور نگه می‌داریم تا audit trail حفظ شود.
- بقیه‌ی منطق lock-acquire/release دست‌نخورده.

### 2. آزادسازی فوری lockهای فعلی روی پست مورد بحث
چون کاربر همین الان مسدود است و نمی‌تواند ۲ دقیقه صبر کند، یک query یک‌باره با `supabase--read_query` ابتدا lockهای فعلیِ گیرکرده را شناسایی می‌کنیم و سپس با `supabase--insert` یا یک edge invocation همان منطق recovery را trigger می‌کنیم. در عمل، خود deploy edge function جدید + یک کلیک Retry Publishing کافی است (چون deploy ~چند ثانیه طول می‌کشد و آستانه‌ی جدید ۲ دقیقه است؛ اگر لازم شد، یک UPDATE مستقیم روی `social_posts` برای پاک‌سازی locks اجرا می‌کنیم).

دقیق‌تر:
- اول: `SELECT id, page_name, publishing_started_at FROM social_posts WHERE status='publishing'` تا ببینیم چه چیزی گیر است.
- بعد: یک `UPDATE social_posts SET status='scheduled', publishing_lock_id=NULL, publishing_started_at=NULL, last_error='Manually cleared after Meta token revocation incident' WHERE status='publishing'` (محدود به همین کاربر/شرکت بر اساس خروجی query).

### 3. هیچ تغییری در:
- منطق lock acquire (خطوط ۳۲۰+) — درست کار می‌کند.
- جدول‌ها یا migration — نیازی نیست.
- frontend — همان toast فعلی کافی است.

### 4. Verification (طبق Post-Change Verification)
- بعد از deploy: یک‌بار retry روی همان پست؛ یا اگر هنوز در lock بود، query تأیید آزادسازی.
- لاگ‌های `social-publish` را با `supabase--edge_function_logs` چک کن که پیام `Clearing stale publishing lock` ظاهر شود و response دیگر 409 نباشد.
- توجه: ارور قرمز اصلی Meta (توکن باطل) جداست؛ این پلن فقط 409 lock را حل می‌کند. publish موفق نیازمند reconnect در Integrations است.

## فایل‌های لمس‌شده
- edited: `supabase/functions/social-publish/index.ts` (تنها یک ثابت زمانی)
- one-off DB cleanup query (در صورت نیاز)
