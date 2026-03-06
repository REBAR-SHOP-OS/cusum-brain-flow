

# آپلود لوگوی شرکت به Storage و رفع خطای Pixel Agent

## وضعیت فعلی
- کد ai-agent **قبلاً اصلاح شده** و لوگو را اختیاری در نظر می‌گیرد (soft-fail)
- اما فایل لوگو در `social-images/brand/company-logo.png` وجود ندارد → Pixel بدون لوگو تصویر تولید می‌کند
- باید این تصویر آپلود‌شده را به Storage منتقل کنیم

## تغییرات

### ۱. کپی فایل لوگو به پروژه
- `user-uploads://favicon-4.png` → `public/brand-logo.png`
- به عنوان fallback همیشه در دسترس خواهد بود

### ۲. فایل: `src/components/social/PixelBrainDialog.tsx`
در `loadLogo` اگر لوگو در Storage پیدا نشد، خودکار فایل `/brand-logo.png` را آپلود کند:

```typescript
const loadLogo = async () => {
  const { data } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(LOGO_PATH, 3600);
  
  if (data?.signedUrl) {
    setLogoUrl(data.signedUrl);
  } else {
    // Auto-seed: upload bundled logo
    const resp = await fetch("/brand-logo.png");
    if (resp.ok) {
      const blob = await resp.blob();
      await supabase.storage
        .from(LOGO_BUCKET)
        .upload(LOGO_PATH, blob, { upsert: true, contentType: "image/png" });
      // Retry signed URL
      const { data: d2 } = await supabase.storage
        .from(LOGO_BUCKET)
        .createSignedUrl(LOGO_PATH, 3600);
      setLogoUrl(d2?.signedUrl ?? null);
    }
  }
};
```

## فایل‌های تغییر
1. `public/brand-logo.png` — کپی لوگوی آپلود‌شده
2. `src/components/social/PixelBrainDialog.tsx` — auto-seed لوگو به Storage در صورت نبودن

