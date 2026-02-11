

## افزودن قابلیت آپلود فایل به ایجنت Pixel (Social Media)

### خلاصه
فعال‌سازی دکمه آپلود فایل (آیکون گیره کاغذ) در چت ایجنت Pixel و جابجایی آن به کنار آیکون آدمک (هدست/Voice Chat).

### تغییرات

**فایل 1: `src/pages/AgentWorkspace.tsx`**
- تغییر شرط `showFileUpload` از فقط `estimating` به `estimating` یا `social`
- هر دو جای ChatInput (هیرو و مکالمه) اعمال می‌شود

**فایل 2: `src/components/chat/ChatInput.tsx`**
- جابجایی دکمه آپلود فایل (Paperclip) از سمت چپ تولبار به کنار دکمه Voice Chat (Headset) در سمت راست
- ترتیب جدید: ... | Headset | Paperclip | [spacer] | Send

### چه چیزی تغییر نمی‌کند
- ظاهر کلی اپلیکیشن
- عملکرد سایر بخش‌ها
- منطق آپلود فایل (همان storage bucket موجود)
- سایر ایجنت‌ها (فقط social و estimating دکمه آپلود دارند)

