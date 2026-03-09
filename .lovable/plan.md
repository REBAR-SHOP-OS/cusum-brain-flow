

# نمایش نوتیفیکیشن‌های Team Hub همیشه به انگلیسی

## مشکل
در حال حاضر، نوتیفیکیشن‌های Team Chat بر اساس `preferred_language` هر کاربر ترجمه می‌شوند. درخواست شما این است که همه نوتیفیکیشن‌ها به **انگلیسی** نمایش داده شوند.

## تغییر — یک فایل، ۱ تغییر جراحی

### `supabase/functions/notify-on-message/index.ts`
در تابع `handleTeamMessage` (خط ۹۱-۱۲۸):
- حذف گروه‌بندی بر اساس زبان (`groupByLanguage`)
- حذف فراخوانی `translateNotification`
- مستقیماً از متن انگلیسی (`titleEn` و `preview`) برای همه کاربران استفاده شود

قبل:
```typescript
const byLang = groupByLanguage(profiles);
for (const [lang, langProfiles] of Object.entries(byLang)) {
  const { title: localTitle, body: localBody } = await translateNotification(...);
  // insert with localTitle, localBody
}
```

بعد:
```typescript
// Always use English for team chat notifications
for (const p of profiles) {
  notifRows.push({ ... title: titleEn, description: preview ... });
  pushPromises.push(fetch(sendPushUrl, { ... title: titleEn, body: preview ... }));
}
```

### بدون تغییر
- `handleSupportMessage` — بدون تغییر
- `notifyTranslate.ts` — بدون تغییر
- کامپوننت‌های UI — بدون تغییر
- دیتابیس — بدون تغییر

