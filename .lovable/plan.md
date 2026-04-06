

# نمایش لیست کاربران @rebar.shop با گزارش عملکرد فردی در Vizzy Brain

## هدف
در ناحیه‌ای که در اسکرین‌شات دور آن دایره کشیده شده (بین هدر و لیست بخش‌ها)، یک ردیف آواتار/نام کاربران @rebar.shop اضافه شود. با کلیک روی هر کاربر، محتوای Brain فیلتر شده و اطلاعات عملکردی آن شخص نمایش داده شود.

## کاربران سیستم (9 نفر)

| نام | ایمیل | وضعیت |
|-----|-------|-------|
| Radin Lachini | radin@rebar.shop | فعال |
| Zahra Zokaei | zahra@rebar.shop | فعال |
| Neel Mahajan | neel@rebar.shop | فعال |
| Saurabh Seghal | saurabh@rebar.shop | فعال |
| Ai | ai@rebar.shop | فعال |
| Sattar Esmaeili | sattar@rebar.shop | غیرفعال |
| Vicky Anderson | anderson@rebar.shop | غیرفعال |
| Kourosh Zand | kourosh@rebar.shop | غیرفعال |
| Behnam Rajabifar | ben@rebar.shop | غیرفعال |

## تغییرات

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`

**اضافه کردن نوار کاربران:**
- بین هدر و محتوای اکاردئون، یک ردیف اسکرول‌شونده افقی از آواتارهای کاربران اضافه شود
- دکمه "All" برای نمایش همه memories (حالت فعلی)
- هر کاربر با آواتار دایره‌ای (حرف اول نام) + نام کوچک نمایش داده شود
- کاربران فعال اول، غیرفعال‌ها با opacity کمتر
- کاربر انتخاب‌شده با حاشیه رنگی مشخص شود

**نمایش اطلاعات عملکردی کاربر:**
- وقتی کاربری انتخاب شود، یک بخش خلاصه عملکرد بالای اکاردئون نمایش داده شود
- داده‌ها از جداول زیر واکشی شود:
  - `time_clock_entries` (profile_id) → ساعات کاری امروز/هفته
  - `activity_events` (actor_id) → رویدادهای اخیر
  - `chat_sessions` (user_id) → تعاملات با AI agents
  - `machine_runs` (operator_profile_id) → عملکرد تولید (برای workshop)
  - `communications` (from_address) → ایمیل‌های ارسال‌شده

**فیلتر Brain memories:**
- وقتی کاربری انتخاب شود، memories مرتبط با آن شخص فیلتر شود (بر اساس metadata یا محتوا)

### 2. `src/hooks/useUserPerformance.ts` (فایل جدید)

یک hook جدید برای واکشی اطلاعات عملکردی یک کاربر:

```typescript
function useUserPerformance(profileId: string | null) {
  // Returns: timeClock (today/week), recentActivity, agentUsage, productionStats
}
```

کوئری‌ها:
- Time Clock: آخرین ورود/خروج امروز + مجموع ساعات هفته
- Activity: آخرین 10 رویداد
- Agent Sessions: تعداد sessions امروز به تفکیک agent
- Machine Runs: تعداد و قطعات تولید‌شده امروز (اگر workshop role دارد)

### 3. UI Layout

```text
┌──────────────────────────────────────────────────────┐
│ 🧠 Vizzy Brain (118) | 🕐 1:07 PM ET  [Analyze] ✕  │
├──────────────────────────────────────────────────────┤
│ [All] [👤Radin] [👤Zahra] [👤Neel] [👤Saurabh] ... │
├──────────────────────────────────────────────────────┤
│ ┌── Radin's Performance ──────────────────────────┐  │
│ │ 🕐 Clocked in: 8:30 AM  |  Hours today: 4.5h   │  │
│ │ 📊 Activities: 12  |  🤖 AI Sessions: 3        │  │
│ │ 📧 Emails sent: 5  |  📞 Calls: 2              │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ 📊 Dashboard (17)                              ▼     │
│ 📥 Inbox (3)                                   ▼     │
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

## نکات فنی
- پروفایل‌ها از `profiles` واکشی شده و فیلتر `email ILIKE '%@rebar.shop'` اعمال می‌شود
- کوئری‌ها timezone-aware هستند (از workspace settings)
- فقط admin‌ها این پنل را می‌بینند پس RLS مشکلی ندارد
- کاربران غیرفعال با استایل dimmed نمایش داده می‌شوند ولی قابل کلیک هستند (برای دیدن سوابق)

