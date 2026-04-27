
# معماری بخش Social Media Manager

این یک نقشهٔ کامل از ساختار فعلی ماژول سوشیال مدیا در ERP است. هیچ تغییری در کد اعمال نمی‌شود — صرفاً یک مرور معماری برای درک دقیق سیستم.

---

## 1) نمای کلی (High-Level)

```text
┌─────────────────────── FRONTEND (React) ───────────────────────┐
│                                                                │
│  /social-media-manager  ──►  SocialMediaManager.tsx (672 خط)   │
│                              │                                 │
│        ┌─────────────────────┼─────────────────────┐           │
│        ▼                     ▼                     ▼           │
│  SocialCalendar       PostReviewPanel        ApprovalsPanel    │
│  (هفتگی/روزانه)       (1619 خط — ویرایشگر    (پنل تأییدات)    │
│                        کامل پست)                               │
│                                                                │
│  Dialogs:  CreateContent · BrandKit · ImageGenerator ·         │
│            ImageEdit · VideoGenerator · PixelBrain ·           │
│            DeclineReason · SettingsSheet · SchedulePopover     │
│                                                                │
│  Hooks:    useSocialPosts · useSocialApprovals ·               │
│            usePublishPost · useAutoGenerate ·                  │
│            useStrategyChecklist                                │
│                                                                │
│  Libs:     schedulePost · socialMediaStorage · socialConstants │
└──────────────────────────────┬─────────────────────────────────┘
                               │ Supabase JS Client
                               ▼
┌──────────────────────── BACKEND (Supabase) ────────────────────┐
│                                                                │
│  Tables (RLS via is_social_team()):                            │
│    • social_posts            (محتوا + متریک‌ها + قفل انتشار)  │
│    • social_approvals        (workflow تأیید + escalation)     │
│    • social_strategy_checklist                                 │
│                                                                │
│  Storage Buckets (public):                                     │
│    • social-media-assets · social-images · generated-videos    │
│                                                                │
│  Edge Functions (Deno):                                        │
│    • auto-generate-post     (تولید AI روزانه — 5 اسلات)        │
│    • regenerate-post        (بازتولید تک پست)                  │
│    • social-publish         (انتشار دستی — Graph API)          │
│    • social-cron-publish    (انتشار خودکار طبق scheduled_date)│
│    • schedule-post          (زمان‌بندی + کلون چندپلتفرمی)      │
│    • approval-notify        (نوتیف تأیید + escalation)         │
│    • social-intelligence    (تحلیل/پیشنهاد)                    │
│    • video-to-social        (تبدیل ویدیو استودیو به پست)       │
│                                                                │
│  Realtime: publication `supabase_realtime` روی هر دو جدول     │
│  Triggers:                                                     │
│    • enforce_social_qa     → جلوگیری از انتشار بدون QA         │
│    • validate_social_approval_status                           │
│    • auto-update updated_at                                    │
│                                                                │
└────────────────┬───────────────────────────────────────────────┘
                 │ Graph API v21.0
                 ▼
        Facebook · Instagram · LinkedIn · X
        (Reels/Stories/Posts با cover_image_url)
```

---

## 2) جدول `social_posts` — هستهٔ داده

| فیلد | نوع | نقش |
|---|---|---|
| `id`, `user_id` | uuid | کلید/مالک |
| `platform` | enum | facebook · instagram · linkedin · twitter · tiktok · youtube · **unassigned** |
| `status` | enum | draft · pending_approval · scheduled · **publishing** · published · failed · declined |
| `qa_status` | enum | needs_review · approved · scheduled · published |
| `neel_approved` | bool | گیت سخت — بدون آن cron منتشر نمی‌کند |
| `title`, `content`, `hashtags[]` | متن | محتوا |
| `image_url`, `cover_image_url` | text | رسانه (Reels به cover نیاز دارد) |
| `content_type` | text | post · reel · story |
| `page_name` | text | نام صفحه/کانال (مثل Rebar.shop) |
| `scheduled_date` | timestamptz | زمان انتشار |
| `publishing_lock_id`, `publishing_started_at` | — | **قفل انتشار** برای جلوگیری از double-post |
| `reach/impressions/likes/comments/shares/saves/clicks` | int | متریک‌ها |
| `decline_reason`, `declined_by`, `last_error` | متن | حسابرسی |

**RLS:** فقط `is_social_team()` می‌تواند SELECT/INSERT/UPDATE/DELETE.
**Trigger امنیتی:** `enforce_social_qa` انتشار بدون عبور از QA را در سطح DB بلاک می‌کند.

---

## 3) جدول `social_approvals` — workflow تأیید

| فیلد | نقش |
|---|---|
| `post_id` → social_posts (CASCADE) | پیوند |
| `approver_id` | تأییدکننده |
| `status` | pending · approved · rejected |
| `deadline` | پیش‌فرض `now() + 4h` |
| `escalation_count` | شمارندهٔ تشدید (auto-approve در شمارهٔ 2) |
| `notified_at`, `decided_at`, `feedback` | حسابرسی |

---

## 4) چرخهٔ عمر یک پست (State Machine)

```text
     ┌──────────────────────────────────────────────────┐
     │                                                  │
[Auto-Generate]                                         │
auto-generate-post  ──►  5×  unassigned/draft           │
(06:30·07:30·08:00·12:30·14:30 ET)                      │
     │                                                  │
     ▼                                                  │
[User edits در PostReviewPanel]                         │
  • انتخاب platform + page_name                         │
  • تنظیم scheduled_date (SchedulePopover)              │
  • تولید تصویر/ویدیو (Image/VideoGeneratorDialog)      │
     │                                                  │
     ▼                                                  │
[Schedule]  schedulePost()  ──►  schedule-post EF       │
  • چک تکراری در همان روز/پلتفرم/صفحه                  │
  • اگر چند page → کلون رکورد                          │
  • status: scheduled, qa_status: scheduled            │
     │                                                  │
     ▼                                                  │
[Approval Gate]                                         │
  ApprovalsPanel ──► useSocialApprovals.approvePost     │
  • approval.status = approved                          │
  • post: status=scheduled, qa_status=approved,         │
          neel_approved=true                            │
  • approval-notify (escalation هر 4h, auto-approve     │
    بعد از escalation_count>=2)                         │
     │                                                  │
     ▼                                                  │
[social-cron-publish]  (اجرای دوره‌ای)                 │
  • SELECT WHERE status=scheduled AND neel_approved     │
    AND scheduled_date <= now() LIMIT 20                │
  • recoverStaleLocks (>10min publishing → failed)      │
  • acquirePublishLock(post_id) ─ اتمیک                 │
  • status → publishing                                 │
  • stripPersianBlock(content)                          │
  • Graph API call (FB/IG/LI/X)                         │
     │                                                  │
     ├── موفق ──► status=published + متریک‌ها           │
     └── خطا  ──► status=failed, last_error=…           │
                                                        │
[Decline]  DeclineReasonDialog ──► status=declined  ────┘
```

---

## 5) Edge Functions — مسئولیت‌ها

| Function | خطوط | کار اصلی |
|---|---|---|
| `auto-generate-post` | 651 | فراخوانی `aiRouter` → تولید 5 پست placeholder (`?`) سپس پر کردن با LLM، استفاده از brain knowledge + brand kit + لوگو |
| `regenerate-post` | 784 | بازتولید یک پست خاص با حفظ تنظیمات |
| `social-publish` | 1124 | انتشار دستی؛ نقش‌های مجاز: admin/marketing/super-admin؛ refresh token صفحات FB؛ پشتیبانی Reels با cover |
| `social-cron-publish` | 813 | حلقهٔ خودکار با قفل انتشار، recovery، فیلتر فارسی |
| `schedule-post` | 230 | زمان‌بندی + کلون چند صفحه‌ای + duplicate guard |
| `approval-notify` | 106 | درج notification برای approver؛ منطق escalation و auto-approve |
| `social-intelligence` | 294 | تحلیل/پیشنهاد محتوا |
| `video-to-social` | 91 | پل بین Video Studio و سوشیال |

`_shared` مهم: `publishLock.ts` (قفل اتمیک)، `roleCheck.ts`، `aiRouter.ts`، `getWorkspaceTimezone.ts`، `accessPolicies.ts`.

---

## 6) فرانت‌اند — نقش هر فایل

**Page**
- `SocialMediaManager.tsx` (672) — توری تقویم هفتگی، فیلترها (پلتفرم/استاتوس)، حالت Selection، Bulk delete، ادغام Brand Kit، Strategy، Approvals.

**Components کلیدی**
- `SocialCalendar.tsx` (369) — رندر گرید هفتگی/روزانه با کارت‌های پست.
- `PostReviewPanel.tsx` (1619) — **بزرگ‌ترین کامپوننت**: ویرایشگر پست، انتخاب صفحه، تولید/ویرایش رسانه، انتشار/زمان‌بندی، چندصفحه‌ای.
- `ApprovalsPanel.tsx` (203) — صف pending با approve/reject.
- `ContentStrategyPanel.tsx` (518) — استراتژی محتوا + checklist.
- `PixelPostCard.tsx` / `PixelPostViewPanel.tsx` / `PixelChatRenderer.tsx` — ظاهر چت‌گونهٔ Pixel.
- `PixelBrainDialog.tsx` (338) — تنظیم instructions و resourceهای brain برای ایجنت Pixel.
- `Image/VideoGeneratorDialog`, `ImageEditDialog` — استودیوی رسانه با ذخیره در bucket `social-media-assets`.
- `VideoStudioContent.tsx` (1108) + `VideoStudioPromptBar.tsx` (706) + `VideoEditor.tsx` + `VideoLibrary.tsx` + `VideoToSocialPanel.tsx` — استودیوی ویدیوی کامل (طبق memory: تولید **بی‌صدا** در منبع و استیچر).
- `SchedulePopover.tsx`, `DeclineReasonDialog.tsx`, `SelectionSubPanel.tsx`, `SettingsSheet.tsx`, `BrandKitDialog.tsx`, `CreateContentDialog.tsx`.

**Hooks**
- `useSocialPosts` — Query + Realtime روی `social_posts`، CRUD mutations.
- `useSocialApprovals` — Query + Realtime روی `social_approvals` + approve/reject با debounce.
- `usePublishPost` — fetch مستقیم به `social-publish` با timeout 120s (برای پردازش طولانی Reels).
- `useAutoGenerate` — درج 5 placeholder در زمان‌های ثابت ET سپس فراخوانی edge function (طبق memory `social/content-strategy-standards`).
- `useStrategyChecklist`, `usePublishPost`.

**Libs**
- `schedulePost.ts` — wrapper با duplicate-guard فرانت + fallback به مستقیم DB در صورت شکست edge function.
- `socialMediaStorage.ts` — آپلود رسانه (data:/blob:/https:) به bucket `social-media-assets` با URL عمومی پایدار.
- `socialConstants.ts` — لیست `PLATFORM_PAGES` (Rebar.shop, Ontario Steel Detailing, …) و `PIXEL_APPROVE_PLATFORMS`.

---

## 7) قواعد امنیتی و تجاری ثبت‌شده در حافظه

- **Content Strategy**: 5 اسلات روزانه ثابت ET — 06:30 / 07:30 / 08:00 / 12:30 / 14:30 (`useAutoGenerate`).
- **Silent Video**: همهٔ ویدیوهای AI Director باید در منبع و استیچر بی‌صدا باشند؛ موسیقی فقط در Pro Editor دستی.
- **Persian Strip**: هم در `usePublishPost` و هم در `social-cron-publish` بلوک `---PERSIAN---` و کاراکترهای فارسی پاک می‌شوند تا هرگز منتشر نشوند.
- **Publish Lock**: در `_shared/publishLock.ts` با `publishing_lock_id` + `publishing_started_at` و recovery 10 دقیقه‌ای.
- **RLS**: تنها `is_social_team()` دسترسی دارد؛ تأیید نقش در `social-publish` با `hasAnyRole(['admin','marketing'])` یا super-admin.
- **Realtime channels**: نام کانال یکتا با `crypto.randomUUID()` (طبق استاندارد `realtime/subscription-standards`).

---

## 8) نکات مهم وضعیت فعلی

- جدول `social_posts` فاقد `company_id` است → tenancy این جدول **user-scoped** است نه company-scoped (برخلاف بقیهٔ ERP). اگر چند شرکت در آینده اضافه شود، نیاز به migration دارد.
- Cron schedule مربوط به `social-cron-publish` و `approval-notify` در schema `cron` ذخیره است (دسترسی psql نداریم — باید از طریق ابزارهای migration دیده شود).
- `PostReviewPanel.tsx` با 1619 خط بزرگ‌ترین فایل ماژول است؛ کاندیدای refactor در آینده.
- مسیر `video-to-social` پل بین Video Studio و social است ولی فقط 91 خط — منطق سنگین در فرانت (`VideoToSocialPanel`) است.

---

این تنها یک گزارش معماری است. در صورت تأیید این پلن هیچ فایلی تغییر نمی‌کند. اگر می‌خواهی روی بخش خاصی (مثلاً Pixel agent، cron jobs، یا refactor PostReviewPanel) عمیق‌تر شویم، بگو تا پلن جداگانه آماده کنم.
