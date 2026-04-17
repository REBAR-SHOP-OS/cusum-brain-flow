

## Plan: Make "AI Prompt" Auto-Write Without Asking the User

### Problem
کاربر می‌گوید دکمه «AI Prompt» باید **خودش** پرامت را بنویسد — نه اینکه از کاربر بخواهد توضیح بدهد. در حال حاضر (طبق تغییر قبلی) یک دیالوگ باز می‌شود و از کاربر می‌خواهد ایده‌اش را تایپ کند، که خلاف خواسته است.

### Root Cause
در `ChatPromptBar.tsx`، دکمه «AI Prompt» الان `setAiDialogOpen(true)` را صدا می‌زند و دیالوگ `AIPromptDialog` را باز می‌کند. کاربر می‌خواهد به رفتار قبلی برگردد: کلیک = تولید خودکار پرامت بر اساس chipهای انتخاب‌شده (Style, Products, Duration, Ratio, Engine).

### Changes

**1. `src/components/ad-director/ChatPromptBar.tsx`**
- دکمه «AI Prompt» را به `handleAiWrite` (تابع قبلی auto-generate) برگردان — نه `setAiDialogOpen(true)`
- `handleAiWrite` باید مستقیماً edge function `ad-director-ai` با `action: "write-script"` را صدا بزند و فقط chip context را بفرستد (بدون ورودی کاربر)
- نتیجه را در textarea اصلی قرار دهد
- در حین تولید: دکمه disabled + spinner نمایش دهد
- توست موفقیت/خطا

**2. `AIPromptDialog` (نگه داشتن یا حذف؟)**
- فایل را نگه می‌داریم اما render نمی‌کنیم — برای استفاده آینده در دسترس بماند (additive-only، طبق Surgical Execution Law)
- state `aiDialogOpen` حذف می‌شود

### What stays the same
- chips (Style, Products, Duration, Ratio, Engine) — بدون تغییر
- intro/outro/character upload cards و badge‌های "Locked to first/final scene" — بدون تغییر
- edge function `ad-director-ai` (`write-script`) — بدون تغییر، فقط بدون متن کاربر صدا زده می‌شود
- دکمه «Create video» — بدون تغییر

### Result
کلیک روی «AI Prompt» → بدون باز شدن هیچ دیالوگ، AI خودش با استفاده از chipهای انتخاب‌شده یک پرامت سینمایی می‌نویسد و در textarea می‌گذارد → کاربر می‌تواند ادیت کند یا مستقیم «Create video» بزند.

