
تشخیص از لاگ‌ها (ریشه مشکل):
1) مشکل فعلی «Machine busy» واقعی است: ماشین `CUTTER-01` الان `running` است و `current_run_id` دارد، ولی `active_job_id` روی آیتمی است که الان `cut_done` و کامل شده (`B1503`، 4/4).  
2) UI در `CutterStationView` فقط وقتی run را active می‌داند که `active_job_id === currentItem.id` باشد؛ پس دکمه `LOCK & START` دیده می‌شود، ولی با کلیک، backend درستاً خطای busy می‌دهد.  
3) یک run orphan هم در دیتابیس دیده می‌شود (running ولی به ماشین لینک نشده) که نشان‌دهنده race در start-run است.  
4) خطای قبلی `Over-consumption` با همین race/تکرار مصرف هم‌جهت است.

برنامه اصلاح (برای پیاده‌سازی):
1) `src/components/shopfloor/CutterStationView.tsx`
- تفکیک stateها:
  - `machineHasActiveRun` (هر run فعال روی ماشین)
  - `runMatchesCurrentItem` (run مربوط به آیتم جاری)
  - `machineIsRunning` فقط برای آیتم جاری
- اگر run فعال برای آیتم دیگری/آیتم مخفی است:
  - دکمه Start غیرفعال شود
  - بنر واضح با «ماشین روی Mark X قفل است» نمایش داده شود
  - اکشن «Clear stale lock» (complete-run با output=0) برای خروج امن
- در نوار lock، مارک واقعیِ active job نمایش داده شود (نه `currentItem`).
- در restore اولیه، اگر active job دیگر actionable نیست (مثلاً `cut_done` یا کامل)، auto-clear اجرا شود.

2) `supabase/functions/manage-machine/index.ts`
- سخت‌گیری backend برای start:
  - قبل از شروع، runهای running orphan برای همان ماشین را پیدا و cancel کند.
  - اگر run فعلی به آیتم complete/cut_done وصل است، auto-recover کند (بدون انتظار 60 دقیقه).
- ضد-race در start-run:
  - claim اتمیک ماشین هنگام set کردن `current_run_id` (شرط `current_run_id is null`)
  - اگر claim شکست خورد، run تازه cancel شود و run موجود برگردد.

3) `supabase/functions/manage-inventory/index.ts`
- idempotency واقعی برای `consume-on-start` بر اساس `(machineRunId, sourceId, sourceType)` تا مصرف تکراری نشود.
- کاهش موجودی با شرط اتمیک (`qty_on_hand >= qty`) تا race باعث over-consumption نشود.
- اگر تکراری بود، پاسخ success + deduplicated بدهد (نه error).

جزئیات فنی (DB/Migration):
- migration پاکسازی: runهای running اضافی/orphan ماشین را به `canceled` ببرد.
- سپس unique partial index:
  `UNIQUE(machine_id) WHERE status='running'`
  تا هم‌زمان بیش از یک run فعال برای یک ماشین غیرممکن شود.
- برای idempotency مصرف، یک ledger table کوچک با unique key اضافه شود (RLS روشن، بدون policy عمومی).

پلن تست پس از اصلاح:
1) سناریوی فعلی را تکرار کنید: اگر run روی آیتم نامعتبر بود، باید بنر lock mismatch ببینید (نه toast مبهم).  
2) با Clear lock، ماشین idle شود و start بعدی موفق شود.  
3) کلیک سریع/دو‌بار start → فقط یک run فعال و فقط یک مصرف موجودی ثبت شود.  
4) کوئری نهایی: برای هر ماشین حداکثر یک `machine_runs.status='running'` وجود داشته باشد.
