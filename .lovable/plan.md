
# رفع باگ: عدم همخوانی تاریخ در Recents با تاریخ انتخابی

## مشکل
متغیر `selectedDate` در لیست وابستگی‌های `handleSend` (useCallback) وجود ندارد. به همین دلیل وقتی کاربر تاریخ را تغییر می‌دهد، تابع `handleSend` همچنان مقدار قدیمی `selectedDate` (تاریخ امروز) را می‌بیند.

## تغییر

### فایل `src/pages/AgentWorkspace.tsx`
اضافه کردن `selectedDate` به آرایه وابستگی‌های `useCallback` در `handleSend`:

```typescript
// قبل:
}, [messages, config.agentType, config.name, activeSessionId, createSession, addMessage, mapping]);

// بعد:
}, [messages, config.agentType, config.name, activeSessionId, createSession, addMessage, mapping, selectedDate]);
```

## نتیجه
با این تغییر، هر بار که کاربر تاریخ را در تقویم عوض کند، `handleSend` مقدار جدید را می‌بیند و عنوان سشن در Recents دقیقا با تاریخ انتخابی یکی خواهد بود.
