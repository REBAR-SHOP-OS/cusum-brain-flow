

## شناسایی دقیق سه ناحیه‌ی مارک‌شده

طبق تصویر:

| ناحیه | چیست | محل کد |
|---|---|---|
| **A** — سه دایره‌ی شناور سمت راست بالای پیش‌نمایش | `FloatingVizzyButton` (صورتی) + `LiveChatWidget` trigger (سبز/چت) + `ScreenshotFeedbackButton` (سبز/camera) | `src/components/layout/AppLayout.tsx` خط 89-96 — **سراسر اپ** |
| **B** — کنترل‌های `1.0× / ZoomIn / ZoomOut / Maximize` در toolbar تایم‌لاین | بلاک zoom در TimelineBar | `src/components/ad-director/editor/TimelineBar.tsx` خط 620-627 |

---

## ⚠️ نکته‌ی مهم — نیاز به وضوح

**سه دکمه‌ی شناور سمت راست (ناحیه A)** فقط در Ad Director نیستند — در **همه‌ی صفحات اپ** (داشبورد، ERP، تسک‌ها، …) ظاهر می‌شوند. این عناصر:
- `FloatingVizzyButton` → دستیار صوتی/هوشمند Vizzy
- `LiveChatWidget` → پنل چت Admin (Vizzy text)
- `ScreenshotFeedbackButton` → ابزار ارسال feedback با اسکرین‌شات

این‌ها در حالت کلی کاربرد دارند ولی **داخل صفحه‌ی Editor ویدیو** فقط مزاحم هستند چون preview ویدیو را می‌پوشانند.

پس بهترین رویکرد **مخفی کردن آن‌ها فقط داخل editor** است، نه حذف کامل.

---

## برنامه‌ی اصلاحی

### فایل ۱: `src/components/ad-director/editor/TimelineBar.tsx` (خط 620-627)
**حذف کامل** بلاک zoom controls (ZoomOut button، نمایش `1.0×`، ZoomIn button، Maximize/Fit button). منطق `zoomLevel` و قابلیت **Ctrl+Scroll zoom** (خط 273-281) دست‌نخورده می‌ماند تا کاربری که می‌خواهد zoom کند، از scroll استفاده کند.

### فایل ۲: `src/components/ad-director/AdDirectorContent.tsx`
وقتی editor فعال است (`flowState === "editor"`), یک data attribute روی wrapper بگذاریم:
```tsx
<div data-hide-floating-widgets="true">…ProVideoEditor…</div>
```
یا ساده‌تر، یک کلاس CSS سراسری روی `<body>` اضافه/حذف کنیم با `useEffect`.

### فایل ۳: `src/components/layout/AppLayout.tsx` (خط 89-96)
سه دکمه‌ی شناور را داخل یک wrapper بگذاریم که با selector زیر مخفی شود:
```tsx
<div className="floating-widgets-zone">
  <FloatingVizzyButton />
  <ScreenshotFeedbackButton />
  <LiveChatWidget />
</div>
```
و در `index.css` یک قانون اضافه کنیم:
```css
body.hide-floating-widgets .floating-widgets-zone { display: none; }
```

سپس در `ProVideoEditor` با `useEffect` کلاس را روی body toggle کنیم:
```ts
useEffect(() => {
  document.body.classList.add("hide-floating-widgets");
  return () => document.body.classList.remove("hide-floating-widgets");
}, []);
```

این روش امن‌ترین است: دکمه‌ها در سراسر اپ سالم باقی می‌مانند، فقط در صفحه‌ی editor مخفی می‌شوند.

### آنچه دست‌نخورده می‌ماند
- خود کامپوننت‌های `FloatingVizzyButton`, `LiveChatWidget`, `ScreenshotFeedbackButton` — هیچ تغییری
- منطق zoom (Ctrl+Scroll) در TimelineBar — حفظ می‌شود
- DB / RLS / API — هیچ تغییری
- سایر صفحات اپ — هیچ تغییری

## نتیجه پس از اصلاح
1. ✅ کنترل‌های ذره‌بین/`1.0×`/Maximize از toolbar تایم‌لاین editor حذف می‌شوند
2. ✅ سه دکمه‌ی شناور سمت راست **فقط داخل editor ویدیو** مخفی می‌شوند
3. ✅ در سایر صفحات اپ، آن سه دکمه طبق روال عادی نمایش داده می‌شوند
4. ✅ کاربر همچنان می‌تواند با Ctrl+Scroll روی timeline zoom کند

