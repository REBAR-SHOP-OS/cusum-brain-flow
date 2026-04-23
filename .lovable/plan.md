

# مستندسازی کامل معماری Social Media Manager

کاربر یک سند جامع و دقیق می‌خواهد (نه فقط نمودار). یک PDF چندصفحه‌ای حرفه‌ای تولید می‌کنم که **تمام جزئیات** ماژول Social Media Manager را پوشش دهد، به‌علاوهٔ نمودار Mermaid موجود.

## خروجی نهایی

یک فایل **PDF** در `/mnt/documents/SocialMediaManager_Full_Architecture.pdf` با ساختار زیر:

### بخش ۱ — خلاصهٔ اجرایی (1 صفحه)
- هدف ماژول، KPIها، موقعیت در ERP، کاربران (Sattar, Neel, تیم سوشال)
- پلتفرم‌های پشتیبانی‌شده و حجم خروجی روزانه (5 پست × پلتفرم)

### بخش ۲ — معماری لایه‌ای کامل (2 صفحه)
- نمودار 7-layer (UI → Hooks → Edge Functions → Services → DB → Storage → External APIs)
- هر لایه با مسئولیت‌ها، ورودی‌ها، خروجی‌ها

### بخش ۳ — UI Components (2 صفحه)
- جدول کامل ۲۵+ کامپوننت در `src/components/social/`
- props اصلی، state management، realtime subscriptions
- screenshot-style ASCII layout از صفحهٔ اصلی

### بخش ۴ — Hooks و Client Libraries (1 صفحه)
- `useSocialPosts`, `useAutoGenerate`, `usePublishPost`, `useSocialApprovals`, `useStrategyChecklist`
- signature، dependencies، error handling، timeout policies
- caching strategy (React Query keys)

### بخش ۵ — Edge Functions کامل (3 صفحه)
- لیست کامل ۱۵+ edge function مرتبط با social
- برای هر function: نام، trigger، input/output، AI model، secrets موردنیاز، rate limit
- شامل: `auto-generate-post`, `regenerate-post`, `social-publish`, `social-cron-publish`, `schedule-post`, `generate-image`, `generate-video`, `translate-caption`, `video-to-social`, `video-intelligence`, `social-intelligence`, `facebook-oauth`, `linkedin-oauth`, `tiktok-oauth`

### بخش ۶ — Database Schema کامل (2 صفحه)
- جدول‌های `social_posts`, `social_approvals`, `social_strategy_checklist`, `brand_kit`, `user_meta_tokens`, `integration_connections`, `knowledge`
- ستون‌ها با type، default، constraints
- RLS policies (متن دقیق)
- triggers و functions
- realtime publication

### بخش ۷ — جریان داده‌ها (2 صفحه)
- 6 سناریو کامل با sequence diagram (Mermaid):
  1. Auto-generate Today
  2. Manual Create
  3. Schedule Post
  4. Cron Publish (every 5 min)
  5. On-demand Publish
  6. Approval Flow

### بخش ۸ — External APIs (1 صفحه)
- Facebook Graph v21.0، Instagram Graph، LinkedIn v2، TikTok، YouTube
- AI providers: Lovable AI Gateway، DashScope (Wan 2.6)، OpenAI (Sora 2، gpt-image-1)
- endpoints، auth method، rate limits، error codes

### بخش ۹ — Security & Hard Rules (1 صفحه)
- Silent Video rule
- No Persian Publish (regex sanitization)
- Owner-first → Team fallback token resolution
- Tokens never client-side
- Idempotent publish (publishLock.ts)
- RLS isolation by `company_id`

### بخش ۱۰ — Operational Concerns (1 صفحه)
- Cron schedule (`pg_cron` jobs)
- Monitoring & logging
- Failure modes و retry logic
- Token refresh strategy
- Storage quotas

### بخش ۱۱ — نمودار Mermaid (1 صفحه)
- نسخهٔ به‌روزشدهٔ نمودار قبلی، embedded به‌صورت تصویر

## مراحل تولید

1. کشف کامل: خواندن همهٔ فایل‌های `src/components/social/`، `src/hooks/use*Social*`، `supabase/functions/*social*` و edge function های مرتبط، schema از `read_query`
2. استخراج RLS policies و triggers با `supabase--read_query`
3. تولید PDF با `reportlab` (نه pptx، چون سند فنی است)
4. embed نمودار Mermaid به‌عنوان PNG (render شده با mmdc)
5. QA: تبدیل PDF به تصاویر و بررسی تک‌تک صفحات

## فایل‌های خروجی

- `/mnt/documents/SocialMediaManager_Full_Architecture.pdf` — سند اصلی (~۱۵ صفحه)
- `/mnt/documents/SocialMediaManager_Architecture.mmd` — نمودار Mermaid (به‌روزشده)

## آنچه دست نمی‌خورد

هیچ تغییری در کد، DB، یا edge functions ایجاد نمی‌شود. فقط مستندسازی.

