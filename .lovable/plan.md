

# تکمیل Vizzy Brain — نمایش همه بخش‌ها + تاریخ گزارش

## مشکلات فعلی (از اسکرین‌شات)

1. **لیبل‌های دسته‌بندی خام نمایش داده می‌شوند** — `business`، `daily_benchmark`، `feedback_fix` و غیره بدون ایموجی و لیبل مناسب
2. **بخش‌های مهم سیستم وجود ندارند** — Time Clock، Production، Orders، Leads، Accounting در Brain نیستند
3. **تاریخ گزارش مشخص نیست** — کاربر نمی‌داند هر گزارش مربوط به چه روزی است

## تغییرات

### 1. فایل: `src/components/vizzy/VizzyBrainPanel.tsx`

**لیبل‌ها**: اضافه کردن دسته‌بندی‌های جدید برای بخش‌های سیستم:
```
timeclock: "⏰ Time Clock"
production: "🏭 Production"  
orders: "📦 Orders"
leads: "🎯 Leads"
accounting: "💰 Accounting"
email: "📧 Email"
crm: "👥 CRM"
```

**تاریخ روی هر کارت**: فرمت تاریخ MemoryCard از `MMM d, HH:mm` به `MMM d, yyyy • HH:mm` تغییر می‌کند تا سال هم مشخص باشد.

**گروه‌بندی با تاریخ**: در هر دسته‌بندی، مموری‌ها بر اساس تاریخ (روز) ساب‌گروپ می‌شوند. مثلا:
```
📊 Daily Benchmarks (11)
  ── Apr 5, 2026 ──
    [card] [card]
  ── Apr 4, 2026 ──
    [card] [card] [card]
```

### 2. فایل: `src/hooks/useVizzyMemory.ts`

**تقویت پرامپت `analyzeSystem`**: پرامپت را به بخش‌های مشخص تقسیم می‌کنم تا AI برای هر بخش سیستم جداگانه گزارش دهد:

```
Scan and report on EACH of these departments separately:
1. TIME CLOCK: Who is clocked in, total hours, anomalies
2. PRODUCTION: Machine status, completed pieces, targets  
3. ORDERS: Today's orders, pending, overdue
4. LEADS: New leads, stalled leads, pipeline
5. ACCOUNTING: Receivables, payables, overdue invoices
6. EMAIL: Unanswered emails, important messages
7. CRM: Customer activity, follow-ups needed

Format: Use [SECTION_NAME] header before each section.
```

**دسته‌بندی هوشمند**: به‌جای ذخیره همه چیز به‌عنوان `brain_insight`، هر بخش با category مناسب ذخیره می‌شود (مثلا `timeclock`، `production`، `orders`).

### نتیجه
- همه بخش‌های سیستم در Brain نمایش داده می‌شوند
- هر مموری تاریخ کامل دارد
- مموری‌ها در هر دسته بر اساس روز گروه‌بندی می‌شوند
- Analyze Now تمام بخش‌ها را اسکن و جداگانه ذخیره می‌کند

