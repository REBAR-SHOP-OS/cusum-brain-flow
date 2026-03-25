

## تشخیص تسک‌های انجام‌شده و گزارش نهایی در Eisenhower Agent

### مشکل
وقتی کاربر می‌گوید "فلان کار را انجام دادم"، ایجنت آیزنهاور آن را به عنوان تسک انجام‌شده تشخیص نمی‌دهد و در گزارش نهایی تفکیکی بین کارهای انجام‌شده و باقی‌مانده وجود ندارد.

### راه‌حل
پرامپت ایجنت آیزنهاور را در `supabase/functions/_shared/agents/growth.ts` به‌روزرسانی می‌کنیم تا:

1. **تشخیص تسک‌های انجام‌شده**: وقتی کاربر در هر مرحله از مکالمه بگوید "X را انجام دادم" یا "X تمام شد"، آن تسک را به عنوان ✅ Done علامت بزند
2. **بخش جدید در گزارش**: گزارش CEO Briefing شامل دو بخش جدید شود:
   - **✅ Completed Tasks** — لیست کارهای انجام‌شده با زمان تقریبی صرف‌شده
   - **⏳ Remaining Tasks** — کارهایی که هنوز باقی مانده با اولویت‌بندی
3. **خلاصه پیشرفت**: در Executive Summary درصد تکمیل (completion rate) اضافه شود

### تغییرات

| فایل | تغییر |
|---|---|
| `supabase/functions/_shared/agents/growth.ts` | افزودن منطق تشخیص Done و بخش‌های جدید به گزارش |

### جزئیات فنی

در پرامپت `eisenhower` (خط 52-249) این موارد اضافه می‌شود:

**Step 2 — بروزرسانی**: تأکید بر اینکه کاربر می‌تواند تسک‌ها را با وضعیت "انجام‌شده" یا "باقی‌مانده" اعلام کند

**قانون جدید — Task Status Tracking**:
- اگر کاربر در هر پیام بگوید "X را انجام دادم / X done / X تمام شد" → آن تسک Done محسوب شود
- اگر کاربر بعداً در مکالمه وضعیت تسکی را آپدیت کند، باید در تحلیل نهایی منعکس شود

**بخش‌های جدید گزارش**:
```
### ✅ Completed Tasks
- Task name — quadrant it belonged to — impact of completion

### ⏳ Remaining / Pending Tasks  
- Task name — quadrant — next step — deadline recommendation

### 📊 Progress Summary
- Total tasks: X | Completed: Y | Remaining: Z
- Completion rate: X%
- Productivity assessment
```

