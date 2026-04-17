

## Plan: Add Sound to AI Video Director Intro Video

### Problem
ویدئوی ورودی صفحه AI Video Director (`/videos/ad-director-intro.mp4`) در حال حاضر با ویژگی `muted` پخش می‌شود، بنابراین هیچ صدایی شنیده نمی‌شود. کاربر می‌خواهد ویدئو با صدا پخش شود.

### Root Cause
در `src/pages/AdDirector.tsx` خط ۱۹، تگ `<video>` صفت `muted` دارد. این لازم بود چون مرورگرها autoplay با صدا را به صورت پیش‌فرض بلاک می‌کنند مگر اینکه کاربر تعامل قبلی داشته باشد.

### Solution
چون این صفحه از طریق کلیک کاربر روی کارت "AI Video Director" در داشبورد باز می‌شود (یعنی user gesture وجود دارد)، می‌توانیم `muted` را حذف کنیم. اما برای اطمینان در صورت بلاک شدن توسط مرورگر، یک fallback اضافه می‌کنیم:

### Changes (1 file)

**`src/pages/AdDirector.tsx`**
1. حذف صفت `muted` از تگ `<video>` تا صدا پخش شود
2. اضافه کردن `controls={false}` صریح برای ظاهر تمیز
3. اضافه کردن دکمه Mute/Unmute کوچک کنار دکمه Skip (با آیکون `Volume2`/`VolumeX`)
4. در `useEffect` پس از mount، تلاش برای `play()` با صدا — در صورت reject شدن توسط مرورگر، خودکار به muted fallback می‌شود و دکمه unmute برای کلیک کاربر فعال می‌ماند
5. اضافه کردن state `isMuted` برای کنترل آیکون

### What stays the same
- مسیر فایل ویدئو، autoPlay، playsInline، onEnded، onError — بدون تغییر
- رفتار دکمه Skip — بدون تغییر
- بقیه صفحه AdDirector — بدون تغییر

### Result
وقتی کاربر روی "AI Video Director" کلیک می‌کند → ویدئوی ورودی **با صدا** پخش می‌شود. اگر مرورگر autoplay با صدا را بلاک کرد، ویدئو silent شروع می‌شود و کاربر می‌تواند با کلیک روی دکمه speaker آن را unmute کند.

