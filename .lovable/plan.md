

## دو اصلاح: آیکون‌های بزرگ‌تر + کپشن کامل در تقویم

### مشکل اول: آیکون‌های Approve و Regenerate خیلی کوچک هستند
در `PixelPostCard.tsx` آیکون‌ها `w-5 h-5` هستند و padding کم دارند (`p-1.5`). باید بزرگ‌تر و به‌صورت دکمه‌های مجزا با پس‌زمینه رنگی نمایش داده شوند.

### مشکل دوم: کپشن کامل در تقویم ذخیره نمی‌شود
در `PixelChatRenderer.tsx` خط 21، مقدار `caption` فقط از alt text تصویر markdown (`![alt text](url)`) خوانده می‌شود که معمولا یک عنوان کوتاه مثل "Rebar Stirrups" است. متن اصلی کپشن (شامل contact info و توضیحات) به‌عنوان `textContent` جدا استخراج و فقط در RichMarkdown نمایش داده می‌شود، اما به `PixelPostData.caption` منتقل نمی‌شود. وقتی کاربر Approve می‌زند، همین caption کوتاه در `social_posts.content` ذخیره می‌شود.

---

### تغییرات

#### 1. `src/components/social/PixelPostCard.tsx` - آیکون‌های بزرگ و مجزا

- آیکون‌ها را از `w-5 h-5` به `w-7 h-7` بزرگ‌تر می‌کنیم
- دکمه‌ها از `p-1.5 rounded-full` به `p-3 rounded-xl` با پس‌زمینه مشخص تغییر می‌کنند
- دکمه Approve: پس‌زمینه سبز ملایم (`bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25`)
- دکمه Regenerate: پس‌زمینه نارنجی ملایم (`bg-orange-500/15 text-orange-500 hover:bg-orange-500/25`)
- فاصله بین دکمه‌ها بیشتر (`gap-3`) و padding پایین بیشتر (`pb-4 px-4`)
- حالت "Saved to calendar": آیکون بزرگ‌تر با رنگ سبز

#### 2. `src/components/social/PixelChatRenderer.tsx` - استخراج کپشن کامل

- در تابع `extractPostData`، بعد از استخراج تصاویر، متن باقی‌مانده (بدون markdown تصویر، بدون هشتگ‌ها) را به‌عنوان `fullCaption` استخراج می‌کنیم
- اگر فقط یک تصویر وجود دارد، کل متن باقی‌مانده caption آن می‌شود
- اگر چند تصویر وجود دارد، متن به‌طور مساوی بین تصاویر تقسیم می‌شود (یا هر بخش متنی قبل از تصویر بعدی به آن تصویر تعلق می‌گیرد)
- `textContent` دیگر در RichMarkdown جداگانه نمایش داده نمی‌شود، بلکه روی کارت پست نمایش داده می‌شود
- نتیجه: وقتی `onApprovePost(post)` صدا زده می‌شود، `post.caption` حاوی کل کپشن واقعی است

#### 3. `src/pages/AgentWorkspace.tsx` - ذخیره کپشن کامل

- در `handleApprovePost`، فیلد `content` از `post.caption` (که حالا کامل است) پر می‌شود
- فیلد `title` از اولین خط caption یا alt text استفاده می‌کند (حداکثر 80 کاراکتر)

---

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/social/PixelPostCard.tsx` | آیکون‌های بزرگ‌تر با رنگ‌بندی مجزا |
| `src/components/social/PixelChatRenderer.tsx` | استخراج کپشن کامل از محتوای markdown |
| `src/pages/AgentWorkspace.tsx` | ذخیره صحیح title و content |
