

# تولید سند معماری کامل Social Media Manager

## خلاصه
تولید یک فایل PDF جامع شامل تمام جزئیات معماری، کدها، و عملکرد بخش Social Media Manager — شامل:

1. **ساختار فایل‌ها و کامپوننت‌ها** — نقشه کامل فایل‌ها با توضیح نقش هر کدام
2. **دیتابیس و جداول** — اسکیمای `social_posts`، `social_approvals`، `user_meta_tokens`، `integration_connections`
3. **State Machine پست‌ها** — تمام وضعیت‌ها (draft → scheduled → publishing → published/failed/declined) و شرایط انتقال
4. **Edge Functions کامل** — کد و منطق `social-publish`، `social-cron-publish`، `schedule-post`، `auto-generate-post`، `regenerate-post`، `approval-notify`
5. **Guards و قوانین امنیتی** — No-Fallback Publishing، Deduplication، Approval Gate، Decline Gate، Persian Strip
6. **Frontend Hooks** — `useSocialPosts`، `usePublishPost`، `useAutoGenerate`، `useSocialApprovals`
7. **کامپوننت‌های UI** — `SocialMediaManager`، `PostReviewPanel`، `SocialCalendar`، `SettingsSheet`
8. **ثابت‌ها و تنظیمات** — `PLATFORM_PAGES`، `PLATFORM_OPTIONS`، time slots
9. **OAuth Flows** — Facebook، Instagram، LinkedIn token management
10. **مشکلات شناخته‌شده و نقاط ضعف**

## فرمت خروجی
فایل Markdown تفصیلی در `/mnt/documents/Social_Media_Architecture_Full.md` شامل کد کامل هر بخش و توضیحات فارسی

## تغییرات فنی
- هیچ تغییری در کدبیس اعمال نمی‌شود
- فقط یک فایل مستند تولید می‌شود با استفاده از `code--exec`
