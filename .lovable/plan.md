

# فیلتر ایجنت‌ها — فقط ایجنت‌های اختصاصی هر کاربر

## مشکل
در حال حاضر `UserAgentsSections` تمام ایجنت‌هایی که کاربر با آن‌ها چت کرده را نشان می‌دهد (از `chat_sessions`). باید فقط ایجنت‌هایی که **رسماً به آن کاربر اختصاص داده شده** نمایش داده شوند.

## منبع داده
- جدول `user_agents` → ایجنت‌های اختصاص‌یافته به هر کاربر (با `agent_id` → `agents.code/name`)
- جدول `chat_sessions` → سابقه چت (فقط برای ایجنت‌های مجاز)

## تغییرات

### 1. هوک `src/hooks/useUserAgentSessions.ts`
- ابتدا لیست ایجنت‌های اختصاصی کاربر از `user_agents` + `agents` واکشی شود
- سپس `chat_sessions` فقط برای همان `agent_name`‌های مجاز فیلتر شود
- ایجنت‌هایی که اختصاص داده شده ولی هنوز چتی ندارند نیز نمایش داده شوند (با `sessionCount: 0`)

```typescript
// 1. Fetch assigned agents
const { data: assigned } = await supabase
  .from("user_agents")
  .select("agents!inner(code, name)")
  .eq("user_id", userId);

// 2. Build allowed agent names set
const allowedAgents = new Map(assigned.map(a => [a.agents.code, a.agents.name]));

// 3. Filter chat_sessions to only allowed agents
const sessions = ... .in("agent_name", [...allowedAgents.keys()]);

// 4. Include assigned agents with 0 sessions
```

### 2. فایل‌های تغییر
- `src/hooks/useUserAgentSessions.ts` — بازنویسی queryFn

### نتیجه
- هر کاربر فقط ایجنت‌های خودش را می‌بیند
- ایجنت‌هایی که به او مرتبط نیست اصلاً نمایش داده نمی‌شود
- ایجنت‌های اختصاصی بدون سابقه چت هم با `(0 sessions)` نشان داده می‌شوند

