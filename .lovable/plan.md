

# فیلتر محتوای Brain برای هر کاربر + نمایش ایجنت‌ها به صورت کشویی

## مشکل فعلی
وقتی روی یک کاربر کلیک می‌شود، فقط کارت Performance نمایش داده می‌شود ولی محتوای اکاردئون Brain همچنان برای همه کاربران است. همچنین هیچ اطلاعاتی از ایجنت‌هایی که کاربر استفاده کرده نمایش داده نمی‌شود.

## تغییرات

### 1. هوک جدید: `src/hooks/useUserAgentSessions.ts`

یک hook برای واکشی session‌های AI هر کاربر از `chat_sessions`:

```typescript
function useUserAgentSessions(userId: string | null) {
  // Query: chat_sessions where user_id = userId, grouped by agent_name
  // For each agent: count sessions, last session date, last 5 messages preview
  // Returns: { agentName, sessionCount, lastUsed, recentMessages[] }[]
}
```

کوئری‌ها:
- `chat_sessions` فیلتر با `user_id` → لیست agent‌ها + تعداد session
- `chat_messages` برای آخرین 3 پیام هر agent (جهت نمایش خلاصه)

### 2. تغییر `src/components/vizzy/VizzyBrainPanel.tsx`

**فیلتر Brain memories:**
- وقتی یک کاربر انتخاب شده، memories بر اساس نام کاربر در `content` فیلتر شوند
- بخش‌های خالی بعد از فیلتر همچنان نمایش داده شوند (مثل حالت All)

**بخش جدید — Agent Sessions:**
- بعد از PerformanceCard و قبل از اکاردئون Brain، یک اکاردئون جداگانه برای ایجنت‌ها اضافه شود
- هر ایجنت یک آیتم کشویی با آیکون + نام ایجنت + تعداد session‌ها
- داخل هر کشوی: آخرین 3 پیام (user/agent) با تاریخ

```text
┌── 🤖 Agent Sessions ────────────────────────┐
│ 🛒 Sales Agent (5 sessions)            ▼    │
│   └ Last: "Please send quote to..."         │
│ 📊 Accounting Agent (2 sessions)       ▼    │
│   └ Last: "Invoice #1234 status..."         │
│ 🏭 Shop Floor Agent (1 session)        ▼    │
│   └ Last: "Machine 3 maintenance..."        │
└─────────────────────────────────────────────┘
```

### 3. UI Layout نهایی (حالت کاربر انتخاب شده)

```text
┌──────────────────────────────────────────────┐
│ [All] [👤Radin*] [👤Zahra] [👤Neel] ...     │
├──────────────────────────────────────────────┤
│ Radin's Performance                          │
│ 🕐 In: 8:30 AM | Hours: 4.5h | AI: 3       │
├──────────────────────────────────────────────┤
│ 🤖 Radin's Agents                            │
│ ├─ Sales Agent (5)                      ▼    │
│ ├─ Accounting Agent (2)                 ▼    │
│ └─ Commander (1)                        ▼    │
├──────────────────────────────────────────────┤
│ 📊 Dashboard (3)  ← filtered for Radin ▼    │
│ 📥 Inbox (1)                            ▼    │
│ ...                                          │
└──────────────────────────────────────────────┘
```

### جزئیات فنی

**فایل‌های تغییر:**
- `src/hooks/useUserAgentSessions.ts` — جدید
- `src/components/vizzy/VizzyBrainPanel.tsx` — اضافه کردن بخش agents + فیلتر memories

**فیلتر memories:** بر اساس `content.toLowerCase().includes(firstName.toLowerCase())` یا `metadata` در صورت وجود فیلد مرتبط

**Agent sessions query:**
```sql
SELECT agent_name, count(*) as session_count, max(updated_at) as last_used
FROM chat_sessions
WHERE user_id = ?
GROUP BY agent_name
ORDER BY last_used DESC
```

