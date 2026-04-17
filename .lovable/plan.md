

## درخواست کاربر
روی هر کارت scene در بخش "Generated Scenes" (زیر preview در صفحه‌ی AdDirector main flow) یک دکمه‌ی **حذف** ✕ نمایش داده شود تا کاربر بتواند scene را حذف کند.

از screenshot: کارت‌های 1. Hook / 2. Problem / 3. Scene 3 — هیچ کدام دکمه‌ی حذف ندارند. کاربر می‌خواهد بتواند scene دلخواه را پاک کند.

## بررسی موردنیاز

نیاز به یافتن:
- کامپوننتی که "Generated Scenes" + کارت‌های scene را render می‌کند (احتمالاً در `src/components/ad-director/`)
- state ای که `scenes`/`storyboard` را نگه می‌دارد و handler `regenerate scene`/`reorder` دارد
- محل اضافه‌کردن آیکون ✕

احتمالاً فایل: `AdDirectorContent.tsx` یا یک sub-component مثل `ScenesGrid.tsx` / `SceneCard.tsx`.

## برنامه (Surgical, Additive)

### ۱. آیکون حذف روی هر کارت
- آیکون `X` از lucide-react
- موقعیت: گوشه‌ی **بالا-راست** کارت (همان جایی که در screenshot دایره‌ی قرمز کشیده شده)
- اندازه: 20×20px با pill background `bg-black/60 hover:bg-red-600/90`
- فقط روی hover کارت کاملاً visible شود (opacity 0 → 100 on hover) تا UI شلوغ نشود؛ روی mobile همیشه visible
- `aria-label="Delete scene"`

### ۲. Handler حذف
- در parent component که `scenes` state را دارد:
  ```ts
  const handleDeleteScene = (sceneId: string) => {
    if (scenes.length <= 1) {
      toast.error("Cannot delete the only scene");
      return;
    }
    // confirm dialog (AlertDialog از shadcn) — جلوگیری از حذف اشتباهی
    setPendingDeleteId(sceneId);
  };
  
  const confirmDelete = () => {
    setScenes(prev => prev.filter(s => s.id !== pendingDeleteId));
    // cleanup وابسته‌ها: clips/videoUrls مربوط به این scene
    toast.success("Scene deleted");
    setPendingDeleteId(null);
  };
  ```
- propagate به card component از طریق prop `onDelete?: (id: string) => void`

### ۳. Confirm dialog
استفاده از `AlertDialog` موجود shadcn:
- عنوان: `Delete this scene?`
- متن: `This will remove the scene and its generated video. This action cannot be undone.`
- دکمه‌ها: `Cancel` / `Delete` (variant=destructive)

### ۴. حفاظت‌ها
- اگر فقط یک scene مانده → دکمه‌ی حذف غیرفعال یا hidden
- اگر scene در حال generate شدن است → غیرفعال با tooltip "Wait for generation to finish"
- بعد از حذف: اگر scene انتخاب‌شده/preview همان بود، به scene اول fallback شود

### ۵. هماهنگی با Edit Video
چون قبلاً در ProVideoEditor (Edit Video) منطق حذف orphan blocks برای text/audio داریم (effect cleanup)، حذف scene از main flow هم به‌طور خودکار در Edit Video صحیح کار می‌کند — هیچ تغییر اضافی لازم نیست.

## فایل‌های تغییرکننده
- کامپوننت کارت scene در main flow (احتمالاً `src/components/ad-director/AdDirectorContent.tsx` یا sub-component) — افزودن آیکون ✕ و prop `onDelete`
- parent state holder — handler `handleDeleteScene` + AlertDialog

دقیقاً کدام فایل‌ها در فاز execute مشخص می‌شوند بعد از grep سریع روی "Generated Scenes" و "Hook".

## آنچه دست‌نخورده می‌ماند
- Veo / Wan / Sora generation pipeline
- Drag-to-reorder logic
- Custom prompt input per scene
- Edit Video editor و timeline lanes (split / transitions / text-audio seeding)
- DB / RLS
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ هر کارت scene یک آیکون ✕ در گوشه‌ی بالا-راست دارد
2. ✅ کلیک → confirm dialog → حذف از لیست + از preview
3. ✅ آخرین scene قابل حذف نیست (محافظت)
4. ✅ Toast feedback به کاربر
5. ✅ سایر بخش‌ها (Edit Video، export) به‌طور خودکار با scene باقی‌مانده کار می‌کنند

