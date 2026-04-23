

# معماری کامل ماژول Social Media Manager

این یک **پلن مستندسازی** است (نه تغییر کد). نقشهٔ کامل مسیر داده از UI تا API های خارجی را ارائه می‌دهد.

## 1) لایهٔ UI — `/social-media-manager`

**صفحهٔ اصلی:** `src/pages/SocialMediaManager.tsx`
- هدر: `Auto-generate today` • `Approvals` • `Pending Approval` • `Strategy` • `Create content` • `Settings`
- نوار وضعیت: `267 Approved posts` • `Edit Brand Kit` • `Add Card` • شمارندهٔ `Published / Total`
- فیلترها: پلتفرم (FB, IG, LinkedIn, X, TikTok, YouTube) • وضعیت (Drafts/Scheduled/Published/Declined)
- Week navigator (Mon→Sun)

**کامپوننت‌های کلیدی** (`src/components/social/`):
| کامپوننت | نقش |
|---|---|
| `SocialCalendar` | شبکهٔ هفتگی + کارت‌های per-page با نشانگر Published/Failed/Pending |
| `PostReviewPanel` | ویرایش کپشن، Translate، تنظیم پلتفرم/Page، Publish، Schedule |
| `CreateContentDialog` | سه مسیر: Manual / Pixel agent / Upload |
| `ApprovalsPanel` + `DeclineReasonDialog` | جریان تأیید |
| `ContentStrategyPanel` + `BrandKitDialog` | استراتژی برند و رنگ/لوگو |
| `SettingsSheet` | برین (instructions/images) |
| `VideoStudioContent` + `VideoLibrary` + `VideoEditor` | استودیوی ویدیو |
| `ImageGeneratorDialog` / `VideoGeneratorDialog` | تولید رسانه |
| `PixelPostCard` / `PixelChatRenderer` | چت Pixel agent |

## 2) Hooks و Client libs

| Hook/lib | مسئولیت |
|---|---|
| `useSocialPosts` | CRUD روی `social_posts` با react-query |
| `useAutoGenerate` | درج ۵ placeholder در ۰۶:۳۰، ۰۷:۳۰، ۰۸:۰۰، ۱۲:۳۰، ۱۴:۳۰ ET، سپس فراخوانی `auto-generate-post` |
| `usePublishPost` | فراخوانی `social-publish` با timeout ۱۲۰s و ضد-دوباره‌انتشار |
| `useSocialApprovals` | لیست approvals |
| `useStrategyChecklist` | چک‌لیست استراتژی |
| `lib/schedulePost.ts` | فراخوانی edge `schedule-post` |
| `lib/socialConstants.ts` | نگاشت `PLATFORM_PAGES` (Rebar.shop, Ontario Steels, …) |

## 3) Edge Functions (Supabase)

**تولید محتوا**
- `auto-generate-post` — captions + images؛ از `knowledge` (agent='social') و لوگو در `social-images/brand/` می‌خواند. Lovable AI Gateway (Gemini 2.5 / GPT) + DashScope Wan 2.6.
- `regenerate-post` — Image-only یا caption rotation با مدل‌های متعدد و dedup علیه ۳۰ فایل اخیر.
- `generate-image` / `generate-video` — Wan 2.6 t2v/i2v، Veo 3.1، Sora 2 (با قانون **Silent Video** — صدای auto حذف می‌شود).
- `translate-caption` — ترجمهٔ Persian preview block.
- `video-to-social` / `video-intelligence` — convert/edit ویدیو.
- `social-intelligence` — analytics.

**انتشار**
- `social-publish` — انتشار on-demand به یک پست. Token resolution: **owner-first → team fallback** در همان company. برای FB/IG token را از `user_meta_tokens` و برای LinkedIn/TikTok از `integration_connections` می‌خواند.
- `social-cron-publish` — cron هر ۵ دقیقه (`pg_cron` job `social-cron-publish-every-5min`). recovery از publishing های stuck > ۱۰ دقیقه و حذف بلاک Persian قبل از publish.
- `schedule-post` — تنظیم زمان.

**OAuth**
- `facebook-oauth` → `user_meta_tokens` (با `pages` و `instagram_accounts` JSON).
- `linkedin-oauth` / `tiktok-oauth` → `integration_connections.config` (encrypted).

## 4) دیتابیس (Postgres + RLS)

| جدول | محتوا | RLS |
|---|---|---|
| `social_posts` | platform, status, scheduled_date, page_name, content, hashtags, image_url, cover_image_url, last_error, declined_by | `is_social_team()` — تیم سوشال CRUD کامل |
| `social_approvals` | post_id, approver_id, status, deadline | تیم سوشال SELECT/UPDATE |
| `social_strategy_checklist` | user_id-scoped | فقط مالک |
| `brand_kit` | colors, logo, website, tagline | فقط مالک |
| `user_meta_tokens` | FB long-lived token + pages[] + instagram_accounts[] | **Deny-all-client** (فقط service_role)؛ ویوی ایمن `user_meta_tokens_safe` |
| `integration_connections` | LinkedIn / TikTok config | service_role |
| `knowledge` (agent='social') | brain instructions + reference images | عمومی برای تیم |
| Storage: `social-images/{brand,pixel}` | لوگو، تصاویر تولیدشده | مدیریت‌شده توسط edge functions |

**Realtime:** `social_posts` و `social_approvals` در `supabase_realtime` publication هستند.

## 5) APIهای خارجی

- **Facebook Graph v21.0** — refresh page token → preflight → publish (post/reel/story)
- **Instagram Graph** — IG Business Account های لینک‌شده به Page؛ انتشار موازی
- **LinkedIn API v2** — userinfo + UGC posts (organization یا personal)
- **TikTok Open API** — video publish
- **YouTube Data API** — ویدیوی تکی
- **Lovable AI Gateway** — Gemini 2.5 Flash/Pro Image, GPT-5-mini, gpt-image-1
- **DashScope** — Wan 2.6 t2v/i2v (1080P، silent)
- **OpenAI** — Sora 2 (ویدیو)، gpt-image-1 (تصویر)

## 6) جریان داده‌ها

```text
A) Auto-generate Today
   Click → useAutoGenerate inserts 5 placeholder rows
        → invoke auto-generate-post (brain + brand_kit + knowledge images)
        → Lovable AI generates caption + image
        → upload to Storage → update social_posts → Realtime → UI refresh

B) Manual Create
   CreateContentDialog → useSocialPosts.createPost → social_posts (status=draft)

C) Schedule
   PostReviewPanel → schedulePost lib → schedule-post edge → social_posts (status=scheduled, scheduled_date)

D) Cron Publish (every 5 min)
   pg_cron → social-cron-publish → SELECT due posts → recover stale locks
        → strip Persian → resolve token (owner→team) → refresh page token
        → Graph/LinkedIn/TikTok/YouTube API → update status=published / failed + last_error

E) On-demand Publish
   PostReviewPanel → usePublishPost → social-publish edge → same path as D

F) Approvals
   Pending → ApprovalsPanel → social_approvals UPDATE → Realtime → kanban refresh
```

## 7) قوانین حساس (HARD)

- **Silent Video:** هیچ ویدیوی تولیدشده توسط Wan/Veo/Sora نباید صدا داشته باشد.
- **No Persian Publish:** بلاک `---PERSIAN---` و کاراکترهای `\u0600-\u06FF` قبل از انتشار strip می‌شوند.
- **Owner-first token, team fallback** فقط درون همان `company_id`.
- **Tokens never client-side:** فقط `*_safe` view و service_role.
- **Idempotent publish:** lock acquire/release از `_shared/publishLock.ts` تا duplicate جلوگیری شود.

## 8) خروجی

نمودار Mermaid کامل به‌عنوان آرتیفکت ضمیمه شده تا با همان ساختار بصری در پروژه قابل بازبینی باشد.

<lov-artifact path="SocialMediaManager_Architecture.mmd" mime_type="text/vnd.mermaid"></lov-artifact>

