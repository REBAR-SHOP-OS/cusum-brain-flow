

## رفع خطای ارسال فیدبک: ستون `metadata` وجود ندارد

### مشکل
خطای `"Could not find the 'metadata' column of 'tasks' in the schema cache"` هنگام ارسال فیدبک اسکرین‌شات رخ می‌دهد. جدول `tasks` ستون `metadata` ندارد ولی کد سعی می‌کند این فیلد را وارد کند.

### تغییرات

**فایل: `src/components/feedback/AnnotationOverlay.tsx`** (خطوط 246-263)

فیلد `metadata` از دستور insert حذف شده و اطلاعات submitter به جای آن در فیلد `description` (که وجود دارد) ذخیره می‌شود:

```typescript
// قبل (خطا دارد):
metadata: JSON.stringify({
  submitter_name: submitterName,
  submitter_email: user?.email,
  submitter_profile_id: submitterProfileId,
}),

// بعد: فیلد metadata حذف و اطلاعات در description اضافه می‌شود
```

اطلاعات submitter از قبل در فیلد `description` موجود هست (`From: ${submitterName}`). فقط `metadata` حذف می‌شود.

### جزییات فنی
- ستون‌های موجود در جدول `tasks`: `id, title, description, status, priority, due_date, assigned_to, customer_id, source, source_ref, agent_type, created_at, updated_at, completed_at, company_id, attachment_url, resolution_note, created_by_profile_id, attachment_urls`
- ستون `metadata` وجود ندارد — `as any` خطای TypeScript را مخفی می‌کرد
- فقط یک تغییر کوچک: حذف سه خط `metadata: JSON.stringify(...)` از insert

