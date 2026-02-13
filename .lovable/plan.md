

# جریان تایید پست در ایجنت Pixel

## جریان جدید (به ترتیب)

```text
1. تصویر ساخته می‌شود
2. کپشن + هشتگ انگلیسی توسط AI تولید می‌شود
3. در چت، کارت پست نمایش داده می‌شود با:
   - تصویر کوچک (thumbnail)
   - پیش‌نمایش کپشن
   - دکمه تایید (checkmark)
4. کاربر روی تایید کلیک می‌کند
5. پست در ستون راست باز می‌شود
6. کاربر می‌تواند کپشن را ادیت کند، زمان‌بندی تعیین کند، اکانت‌ها را انتخاب کند
```

## تغییرات

### 1. PixelPostCard.tsx -- بازطراحی کارت

کارت فعلی فقط "Created a post" و دکمه View دارد. کارت جدید:

```text
+-------+----------------------------+------+
| thumb | Caption preview...         |  ✓   |
| 48x48 | #hashtag #hashtag          |      |
+-------+----------------------------+------+
```

- تصویر thumbnail کوچک از پست (به جای آواتار ایجنت)
- پیش‌نمایش کپشن (یک خط، truncated)
- هشتگ‌ها با رنگ متفاوت
- دکمه تایید با آیکون CheckCircle2 (به جای دکمه View)
- بعد از تایید، آیکون تغییر می‌کند به حالت تایید شده (سبز) و دکمه غیرفعال می‌شود

### 2. PixelPostData -- افزودن فیلد hashtags

```typescript
export interface PixelPostData {
  id: string;
  imageUrl: string;
  caption: string;
  hashtags?: string;      // NEW
  platform?: string;
  status: "published" | "scheduled" | "draft";
}
```

### 3. PixelPostViewPanel.tsx -- افزودن ادیت کپشن و هشتگ

بعد از تصویر و قبل از بخش Schedule، اضافه می‌شود:

- **Caption**: یک textarea قابل ویرایش با محتوای کپشن پست
- **Hashtags**: یک input/textarea قابل ویرایش با هشتگ‌ها
- تغییرات فقط در state محلی ذخیره می‌شوند (بدون ذخیره در دیتابیس)

### 4. PixelChatRenderer.tsx -- استخراج کپشن و هشتگ

رندرر فعلی caption را از alt text تصویر مارک‌داون می‌گیرد. باید هشتگ‌ها را هم از متن اطراف تصویر استخراج کند (خطوطی که با # شروع می‌شوند).

### 5. PixelPostCard -- منطق تایید

- State داخلی `confirmed` برای هر کارت
- قبل از تایید: دکمه با آیکون CheckCircle خاکستری
- بعد از کلیک: آیکون سبز می‌شود + `onView(post)` فراخوانی می‌شود تا پست در پنل راست باز شود

## جزئیات فنی

| فایل | تغییر |
|------|--------|
| `src/components/social/PixelPostCard.tsx` | بازطراحی: thumbnail + caption preview + confirm button |
| `src/components/social/PixelPostViewPanel.tsx` | افزودن textarea برای caption و hashtags |
| `src/components/social/PixelChatRenderer.tsx` | استخراج hashtags از متن |

هیچ تغییری در ایجنت‌های دیگر، دیتابیس، یا API ایجاد نمی‌شود. همه چیز فقط UI است.

