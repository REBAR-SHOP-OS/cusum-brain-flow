# Social Media — قوانین، وظایف و هاردکدها (مستندسازی، بدون تغییر کد)

این یک گزارش اطلاعاتی است؛ هیچ تغییری در کد اعمال نمی‌شود.

---

## 1) صفحه‌ی اصلی — `src/pages/SocialMediaManager.tsx`

وظیفه: نمایش تقویم هفتگی، فیلترها، اکشن‌های بالا (Auto-generate, Approvals, Pending, Strategy, Create, Settings), 605 Approved / Brand Kit / Add Card / Story (5 cards), Selection mode + Bulk delete, و باز کردن `PostReviewPanel`.

هاردکدها:
```ts
platformFilters = [all, facebook, instagram, linkedin, twitter (X/Twitter), tiktok, youtube]
statusFilters   = [all, draft, scheduled, published, declined]
STORY_PRODUCTS  = [
  "Rebar Stirrups","Rebar Cages","Rebar Hooks","Rebar Dowels",
  "Circular Ties / Bars","Fiberglass Rebar (GFRP)","Wire Mesh",
  "Rebar Tie Wire","Rebar Accessories"
]
// انتخاب اندازه‌ی Story:
aspect options = ["9:16 — Story/Reel", "1:1 — Square", "4:5 — Portrait", "16:9 — Landscape"]
// هفته از دوشنبه شروع می‌شود:
startOfWeek(..., { weekStartsOn: 1 })
// زمان پیش‌فرض Add Card:
scheduled = format(date, "yyyy-MM-dd'T'10:00:00")
```

منطق فیلتر مخصوص:
- `approved_by_neel` → `posts.filter(p => p.neel_approved)`
- `pending_approval` → `!p.neel_approved && (status==='pending_approval' || 'scheduled')` و مرتب بر اساس تاریخ.

---

## 2) صفحات و کانال‌ها — `src/lib/socialConstants.ts`

تنها منبع حقیقت (Hardcoded) برای صفحات هر پلتفرم:
```
facebook / instagram (هرکدام 6 صفحه):
  Ontario Steel Detailing, Rebar.shop, Ontario Digital Marketing,
  Ontario Logistics, Ontario Steels, Rebar.shop Ontario

linkedin: Sattar Esmaeili-Oureh (Personal), Rebar.shop Ontario, Rebar.shop
youtube : Ontario Steel Detailing
tiktok  : Ontario Steel Detailing
```

---

## 3) Auto-Generate — `src/hooks/useAutoGenerate.ts`

وظیفه: ساخت placeholder cards و سپس فراخوانی edge function `auto-generate-post`.

هاردکدها:
```ts
PLACEHOLDER_TIMES = [
  06:30, 07:30, 08:00, 12:30, 14:30     // 5 اسلات روزانه (Eastern -04:00)
]
Timezone offset → -04:00 (America/Toronto DST)
Generation timeout = 120000 ms (2 دقیقه)
POLL_DELAYS_MS (post mode)  = [5s, 15s, 30s]
POLL_DELAYS_MS (story mode) = [5,15,30,45,60,80,100,120,150,180] s
Story mode + 9:16 → content_type = "story"  (بقیه‌ی نسبت‌ها = feed)
Default platforms = ["unassigned"]
```

---

## 4) Approvals — `src/components/social/ApprovalsPanel.tsx` و `useSocialApprovals.ts`

وظیفه: نمایش/تأیید/رد درخواست‌های تأیید.

هاردکدها:
```ts
APPROVERS = ["neel@rebar.shop", "sattar@rebar.shop"]   // فقط این دو می‌توانند Approve کنند
platformColors = { facebook:blue, instagram:pink, linkedin:sky-600,
                   twitter:foreground, tiktok:violet, youtube:red }
Realtime debounce = 500 ms
History list      = آخرین 20 مورد
```
Approve → `social_approvals.status='approved'` + `social_posts.{status:'scheduled', qa_status:'approved', neel_approved:true}`.
Reject  → نیاز به feedback؛ `social_posts.status='declined'`.

---

## 5) Post Review Panel — `src/components/social/PostReviewPanel.tsx`

هاردکدها:
```ts
canPublish (دکمه Publish دستی) = email === "radin@rebar.shop" || "zahra@rebar.shop"
Neel Approval Button فقط برای = "neel@rebar.shop" || "sattar@rebar.shop"
Story image gate = حتماً 9:16 (Hard 9:16 gate)
```

---

## 6) تقویم — `src/components/social/SocialCalendar.tsx` و `socialPostStatus.ts`

وظیفه‌ی `resolveDisplayStatus`: نمایش وضعیت واقعی به‌جای اعتماد به ستون `status` که در حالت «publishing» می‌تواند گیر کند.

پنجره‌های Stale (هاردکد):
```ts
IMAGE_STALE_MS    = 3 دقیقه   // پست تصویری
VIDEO_STALE_MS    = 20 دقیقه  // ویدئو/Reel
MIXED_FINALIZE_MS = 1 دقیقه   // ترکیب موفق+ناموفق → published(partial)
```

رنگ‌ها/Approval Soon:
```ts
approvalDueSoon = scheduled && !isApproved && (scheduledDate - now) < 60 دقیقه
PLATFORM_ORDER  = [unassigned, facebook, instagram, linkedin, twitter, tiktok, youtube]
STATUS_LABELS   = { published:"Published ✅", scheduled:"Scheduled 📅",
                    draft:"Draft", pending_approval:"Pending Approval ⏳",
                    declined:"Declined ❌", publishing:"Publishing 🔄",
                    failed:"Failed ❌" }
Brand icons hard-coded:
  facebook  bg=#1877F2
  instagram bg=gradient #833AB4→#FD1D1D→#F77737
  linkedin  bg=#0A66C2
  youtube   bg=#FF0000
  twitter/tiktok bg=black
```

---

## 7) آپلود رسانه — `src/lib/socialMediaStorage.ts`

```ts
BUCKET = "social-media-assets"
ویدئو → normalizeForInstagram(blob)  // IG-safe MP4
پسوند فایل از MIME واقعی blob: webm/mov/mkv/mp4 (default mp4) | png/webp/gif/jpg
نام فایل: `${type}s/${UUID}.${ext}`
```

---

## 8) Edge: `schedule-post` (`supabase/functions/schedule-post/index.ts`)

نقش: زمان‌بندی پست + کلون چندپلتفرمی + پاکسازی کارت‌های unassigned.
گارد‌ها (همه هاردکد):
- زمان‌بندی در گذشته → `400 "Cannot schedule a post in the past"`
- پست `declined` → `403 "This post was declined and cannot be scheduled"`
- Story بدون media (image/cover/video) → backfill از sibling؛ در صورت نبود → `400 "Cannot schedule story: media (image or video) is required."`
- پست‌های غیر Story با content خالی → backfill caption از sibling؛ در نبود → `400 "Cannot schedule: this post has no caption content..."`
- جستجوی sibling: همان `title` همان روز همان user.
- role gate: `requireAnyRole: ["admin","marketing"]`.

---

## 9) Edge: `social-publish` (دستی)

ترتیب گارد‌ها:
1. نقش = admin یا marketing یا email در `SUPER_ADMIN_EMAILS` (در غیر این صورت 403).
2. اگر status=`published` و هیچ صفحه‌ی failed نمانده → `409 "already been published"`.
3. اگر status=`publishing`:
   - اگر `publishing_started_at` بیش از `STALE_MS = 2 دقیقه` → پاک کردن قفل و ادامه.
   - وگرنه → `409 "This post is currently being published. Please wait."`
4. status=`declined` → `403 "This post was declined ..."`
5. **Duplicate guard** (مگر `force_publish=true`): اگر امروز پستی با همان content+image و حداقل یک page مشترک منتشر شده → `409 Duplicate`.
6. **HARD GATE — Neel approval**:
```ts
if (!existing.neel_approved)
  return 403 "This post requires Neel's approval before publishing."
```
7. قفل اتمیک: `acquirePublishLock` با statuses مجاز:
```
force_publish=true  → ["scheduled","draft","failed","pending_approval","published"]
force_publish=false → ["scheduled","draft"]
```
8. ثابت‌های API:
```
GRAPH_API = "https://graph.facebook.com/v21.0"
publishSchema: platform ∈ [facebook,instagram,linkedin,twitter]
content_type ∈ ["post","reel","story"] (default "post")
message max = 63206 chars
```

---

## 10) Edge: `social-cron-publish` (Cron خودکار)

`internalOnly: true`, `authMode: "none"` — فقط داخلی.

مراحل:
- `recoverStaleLocks(supabase)` → پست‌های گیرکرده در `publishing` بیش از 10 دقیقه → `failed`.
- کوئری پست‌های آماده‌ی انتشار:
```sql
status='scheduled' AND neel_approved=true AND scheduled_date<=NOW()
ORDER BY scheduled_date LIMIT 20
```
- پست‌های `scheduled & !neel_approved & scheduled_date<=NOW()` →
  `last_error = "Awaiting Neel/Sattar approval — scheduled time passed. Approve to publish."`
- پست‌های `!neel_approved` که از نیمه‌شب UTC گذشته‌اند →
  `status='failed', qa_status='needs_review', last_error="Approval deadline passed — not approved by Neel/Sattar"`
- Auto-promote: `qa_status='scheduled' & status='draft'` → `status='scheduled'`.
- `SUPPORTED_PLATFORMS = ["facebook","instagram","linkedin"]` (بقیه skip).
- `stripPersianBlock`: حذف هر بلوک `---PERSIAN---`, خطوط `🖼️ متن روی عکس:`/`📝 ترجمه کپشن:`, و هر خط دارای کاراکتر فارسی/عربی (`\u0600-\u06FF` …). **هرگز متن فارسی پابلیش نمی‌شود.**
- Duplicate guard مشابه social-publish (content+image+page overlap همان روز).
- اگر `page_name` خالی باشد → fail با: `"No pages assigned to post (page_name is empty)..."`
- IG: تطبیق `instagram_accounts.pageId === page.id`؛ بدون لینک → skip with error.
- مدیریت توکن: `resolveValidMetaToken` (self → teammate همان company).
- نتیجه‌ی نهایی: حداقل یک صفحه موفق → `published` (به‌علاوه‌ی `last_error: " (failed on: …)"` در صورت partial)؛ همه fail → `failed`.

---

## 11) Edge: `approval-notify`

دو حالت:
- `mode="escalate"`: روی هر `social_approvals.status='pending'` با `deadline<NOW()`:
  - اگر `escalation_count >= 2` → **AUTO-APPROVE** (`approval.status='approved'`, `posts.status='scheduled'`, feedback="Auto-approved after escalation timeout") ⚠️ این مسیر صرفاً وضعیت پست را scheduled می‌کند ولی `neel_approved` را روشن **نمی‌کند** (به‌دلیل DB trigger، در ادامه).
  - وگرنه: `escalation_count++`, deadline = now + **4 ساعت**, notify.
- حالت عادی: درج notification با عنوان "📝 New post needs your approval", priority=`high`, لینک `/social-media-manager`, agent_name `"Pixel"`.

---

## 12) DB Trigger — HARD GATE نهایی

`supabase/migrations/20260612193003_*.sql` → تابع `enforce_neel_only_approval()` روی `social_posts`:
```sql
IF NEW.neel_approved تغییر کرد و = true THEN
  IF auth.uid() IS NULL THEN
    RAISE 'neel_approved can only be set by an approver (no service-role bypass)';
  END IF;
  IF lower(email) NOT IN ('neel@rebar.shop','sattar@rebar.shop') THEN
    RAISE 'Only neel@rebar.shop or sattar@rebar.shop can approve social posts';
  END IF;
END IF;
```
نتیجه: حتی edge function با service-role هم نمی‌تواند `neel_approved=true` بگذارد؛ فقط لاگین این دو ایمیل.

---

## 13) جدول `social_posts` (شکل داده) — `useSocialPosts.ts`

```ts
platform ∈ facebook|instagram|linkedin|twitter|tiktok|youtube|unassigned
status   ∈ published|scheduled|draft|declined|pending_approval|publishing|failed
qa_status∈ needs_review|approved|scheduled|published
فیلدهای کلیدی: title, content, image_url, scheduled_date, hashtags[],
              content_type, page_name (CSV), neel_approved (boolean),
              decline_reason, declined_by, last_error,
              publishing_lock_id, publishing_started_at,
              page_results: [{name,status:'success|failed|pending',error?,platform_post_id?}]
متریک‌ها: reach, impressions, likes, comments, shares, saves, clicks
```

---

## 14) جریان End-to-End

```
Auto-generate (5 placeholders 06:30/07:30/08:00/12:30/14:30)
  → auto-generate-post (Pixel) caption/image
  → کاربر در Calendar/PostReviewPanel ادیت
  → schedulePost() / schedule-post EF (گارد‌ها) → status=scheduled, qa_status=scheduled
  → Approval توسط neel@ یا sattar@ → neel_approved=true (تنها مسیر مجاز، توسط DB trigger)
  → social-cron-publish (هر اجرا): status='scheduled' & neel_approved=true & due
       → publish به FB/IG/LinkedIn (نه TikTok/YouTube/X)
       → page_results پر می‌شود → UI با resolveDisplayStatus در عرض ثانیه‌ها وضعیت واقعی را نشان می‌دهد
  → Recovery: قفل >10min → failed؛ deadline gizmoش گذشته بدون تأیید → failed (نیمه‌شب UTC)
```

---

## 15) خلاصه‌ی Hard Rules غیرقابل‌دور‌زدن

| مکان | قانون |
|---|---|
| DB trigger | فقط `neel@rebar.shop` یا `sattar@rebar.shop` می‌توانند `neel_approved=true` بگذارند (هیچ service-role bypass) |
| social-publish | بدون `neel_approved` → 403 |
| social-publish | پست declined → 403 |
| social-publish | پست published بدون صفحه‌ی failed → 409 |
| social-publish | قفل publishing < 2min → 409 |
| social-cron-publish | فقط `neel_approved=true` پابلیش می‌شود |
| social-cron-publish | متن فارسی هرگز منتشر نمی‌شود (stripPersianBlock) |
| social-cron-publish | بدون `page_name` → fail |
| schedule-post | زمان گذشته/declined/story بدون media → reject |
| Story | فقط 9:16 (هاردکد در PostReviewPanel و useAutoGenerate) |
| ApprovalsPanel | دکمه Approve فقط برای `neel@` و `sattar@` |
| PostReviewPanel | Publish دستی فقط برای `radin@` و `zahra@` (در کنار neel/sattar از طریق Approve) |

این مستندسازی صرفاً جهت اطلاع است و هیچ تغییری در کد ایجاد نشده.
