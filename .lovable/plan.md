

## ارسال واقعی پست به اکانت اینستاگرام انتخاب‌شده

### مشکل فعلی
وقتی "Publish" زده می‌شود، سیستم همیشه پست را به **اولین اکانت اینستاگرام** (Ontario Steel Detailing) ارسال می‌کند. انتخاب صفحه (Pages) در پنل کنار فقط ظاهری است و هیچ تأثیری در ارسال ندارد.

### راه‌حل
انتخاب صفحه (`localPage`) را به edge function منتقل می‌کنیم تا پست به اکانت صحیح ارسال شود.

### تغییرات

**1. `src/components/social/PostReviewPanel.tsx`**
- مقدار `localPage` (نام صفحه انتخاب‌شده) را به `publishPost` پاس بدهیم

**2. `src/hooks/usePublishPost.ts`**
- پارامتر جدید `page_name` را به body درخواست edge function اضافه کنیم

**3. `supabase/functions/social-publish/index.ts`**
- پارامتر `page_name` را از body بخوانیم (اختیاری)
- اگر `page_name` ارسال شده، به جای `pages[0]`، صفحه‌ای که `name` آن مطابقت دارد را پیدا کنیم
- برای اینستاگرام: اکانت اینستاگرام مرتبط با آن صفحه (از طریق `pageId`) را انتخاب کنیم
- برای فیسبوک: همان `pageId` مطابقت‌یافته استفاده شود

### جزئیات فنی

| فایل | تغییر |
|------|-------|
| `PostReviewPanel.tsx` خطوط 451-453 و 393-395 | پاس دادن `page_name: localPage` به `publishPost` |
| `usePublishPost.ts` خط 11-18 و 26-33 | اضافه کردن `page_name?: string` به تایپ ورودی و ارسال آن در body |
| `social-publish/index.ts` خطوط 43-48 | اضافه `page_name` به schema (اختیاری) |
| `social-publish/index.ts` خطوط 86-88 | پیدا کردن `pageId` براساس `page_name` به جای `pages[0]` |
| `social-publish/index.ts` خطوط 103-111 | پیدا کردن `igAccount` مرتبط با `pageId` انتخاب‌شده |

### جریان جدید

```text
1. کاربر صفحه "Rebar.shop" را در پنل انتخاب می‌کند
2. دکمه Publish → page_name: "Rebar.shop" ارسال می‌شود
3. Edge function صفحه با name "Rebar.shop" را پیدا می‌کند → pageId: 101433255155689
4. برای اینستاگرام: igAccount با pageId مطابق → id: 17841446948101406 (username: rebar.shop)
5. پست واقعاً به @rebar.shop در اینستاگرام ارسال می‌شود
```

### نکات
- اگر `page_name` ارسال نشود، رفتار فعلی (اولین صفحه) حفظ می‌شود (backward compatible)
- هیچ تغییری در دیتابیس لازم نیست
