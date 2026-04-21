
# حذف کامل قابلیت Auto-Edit

## فرانت‌اند
حذف از `src/components/ad-director/ChatPromptBar.tsx`:
- import: `AutoEditDialog` و آیکون `Film` (اگر جای دیگری استفاده نشده).
- state: `autoEditOpen` (خط ۲۰۱).
- بلوک Tooltip دکمهٔ Auto-Edit (خطوط ۷۴۵–۷۵۹).
- رندر `<AutoEditDialog ... />` (خط ۸۳۴).

## فایل‌های فرانت‌اند که کامل پاک می‌شوند
- `src/components/ad-director/AutoEditDialog.tsx`
- `src/components/ad-director/AutoEditUploadStep.tsx`
- `src/components/ad-director/AutoEditStoryboardStep.tsx`
- `src/lib/rawVideoUtils.ts` (مخصوص همین flow)

## بکند (Edge Function)
- حذف کامل `supabase/functions/auto-video-editor/` با `supabase--delete_edge_functions`.
- `supabase/config.toml` نیازی به ویرایش ندارد (بلوکی برای این function ندارد).

## آنچه دست نمی‌خورد
- بقیهٔ دکمه‌های ChatPromptBar (AI Prompt، Character، Create video).
- بقیهٔ صفحهٔ `/ad-director` و سایر edge functionها.
- هیچ schema/RLS/storage.

## اعتبارسنجی
1. صفحهٔ `/ad-director` لود شود — دکمهٔ سبز Auto-Edit دیگر دیده نشود.
2. هیچ خطای import در console نباشد.
3. در لیست Edge Functions، `auto-video-editor` حذف شده باشد.
