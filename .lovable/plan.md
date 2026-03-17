

## حل ارور "content must be at least 20 characters" برای Story

### مشکل
استوری‌ها طبق قوانین سیستم فقط عکس هستند و کپشن ندارند. اما `SchedulePopover.tsx` هنگام اسکجول کردن، بدون توجه به نوع محتوا، حداقل ۲۰ کاراکتر محتوا می‌خواهد.

- `PostReviewPanel.tsx` خط 936: **درست** — استوری را exempt کرده (`localContentType !== "story"`)
- `SchedulePopover.tsx` خط 50: **مشکل** — بدون بررسی content_type، همه پست‌ها را چک می‌کند

### تغییرات

**`src/components/social/SchedulePopover.tsx`** — خط 50
- شرط را تغییر بده: اگر `post.content_type === "story"` باشد، چک ۲۰ کاراکتری skip شود
- کد جدید:
```typescript
if (post.content_type !== "story" && (post.content || "").length < 20) {
```

یک تغییر تک‌خطی — ریشه مشکل حل می‌شود.

