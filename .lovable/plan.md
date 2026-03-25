

## اصلاح تولبار چت ایجنت آیزنهاور

### مشکل
در صفحه ایجنت آیزنهاور، تولبار پایین چت شامل آیکون‌های اضافی (ایموجی، تمپلیت، فرمتینگ، هش‌تگ) است. کاربر فقط می‌خواهد آیکون **ویس** (با انتخاب زبان) و **Attach** باقی بمانند.

### تغییرات

**فایل: `src/pages/AgentWorkspace.tsx`**
- یک prop جدید به `ChatInput` اضافه شود: `voiceAndAttachOnly={agentId === "eisenhower"}`
- این prop در هر دو جایی که `ChatInput` رندر می‌شود (خط 891 و 921) اعمال شود

**فایل: `src/components/chat/ChatInput.tsx`**
- prop جدید `voiceAndAttachOnly?: boolean` به interface اضافه شود
- در بخش تولبار (خط 416-460): وقتی `voiceAndAttachOnly` فعال باشد، فقط `VoiceInputButton` رندر شود (بدون ایموجی، تمپلیت، فرمتینگ، هش)
- بخش `showFileUpload` (attach) بدون تغییر باقی بماند چون همین الان هم نمایش داده می‌شود

### منطق تولبار بعد از تغییر

```text
voiceAndAttachOnly=true  →  [Voice+LangSelector] [Attach]  [........textarea........]  [Send]
voiceAndAttachOnly=false →  [Emoji] [Voice] [Templates] [Format] [Hash] [Attach]  [textarea]  [Send]
```

### فایل‌های درگیر
- `src/components/chat/ChatInput.tsx`
- `src/pages/AgentWorkspace.tsx`

