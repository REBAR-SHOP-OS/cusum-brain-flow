

## تغییرات: افزودن آپلود تصویر ابتدا/انتها + انتخاب مدت ویدیو

### توضیح

کاربر می‌خواهد در صفحه چت:
1. **دو آیکون بزرگ** برای آپلود تصویر ابتدای ویدیو (Intro) و انتهای ویدیو (Outro)
2. **انتخاب مدت زمان ویدیو** با گزینه‌های 15 ثانیه، 30 ثانیه، 1 دقیقه

### تغییرات

**فایل: `src/components/ad-director/ChatPromptBar.tsx`**

- اضافه کردن دو باکس بزرگ بالای textarea:
  - **Intro Image** (سمت چپ) — آیکون بزرگ با قابلیت آپلود عکس
  - **Outro Image** (سمت راست) — آیکون بزرگ با قابلیت آپلود عکس
  - هر دو با پیش‌نمایش عکس آپلود شده و دکمه حذف
- اضافه کردن pill buttons برای مدت زمان: `15s` | `30s` | `1min` کنار ratio pills
- تغییر signature به `onSubmit: (prompt, ratio, images, introImage, outroImage, duration) => void`

**فایل: `src/components/ad-director/AdDirectorContent.tsx`**

- دریافت `introImage`, `outroImage`, `duration` از ChatPromptBar
- ارسال duration به pipeline تولید ویدیو

### طرح UI

```text
┌──────────────────────────────────────┐
│  ┌─────────┐          ┌─────────┐   │
│  │  📷     │          │  📷     │   │
│  │ Intro   │          │ Outro   │   │
│  │ Image   │          │ Image   │   │
│  └─────────┘          └─────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Describe your video idea...  │   │
│  │                              │   │
│  │ [📎] [16:9][9:16][1:1][4:3] │   │
│  │ [15s][30s][1min]         [→] │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

### فایل‌ها
- `src/components/ad-director/ChatPromptBar.tsx` — UI جدید
- `src/components/ad-director/AdDirectorContent.tsx` — دریافت پارامترهای جدید

