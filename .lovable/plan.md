

# افزودن دکمه ورود با Google به صفحه Login

## هدف
دکمه "Sign in with Google" به صفحه لاگین اضافه شود تا کاربران ثبت‌نام‌شده بتوانند راحت‌تر وارد شوند. این فقط برای **ورود** است، نه ثبت‌نام جدید.

## تغییرات

### فایل: `src/pages/Login.tsx`
- اضافه کردن import از `lovable` (`@/integrations/lovable`)
- اضافه کردن state برای `googleLoading`
- اضافه کردن handler `handleGoogleSignIn` با استفاده از `lovable.auth.signInWithOAuth("google")`
- اضافه کردن یک separator ("or") بعد از دکمه email
- اضافه کردن دکمه "Sign in with Google" با آیکون Google SVG
- حذف لینک "Having trouble signing in? Clear session" (طبق تصویر کاربر که آن را دور زده)

### جزئیات فنی
- از `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` استفاده می‌شود (Lovable Cloud managed)
- نیازی به تنظیمات اضافی نیست — Google OAuth به صورت managed در Cloud فعال است
- دکمه Google بعد از separator "or" و زیر دکمه email قرار می‌گیرد

