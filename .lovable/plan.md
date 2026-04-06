

# اضافه کردن ساعت زنده Timezone به هدر Vizzy Brain

## تغییر

### فایل: `src/components/vizzy/VizzyBrainPanel.tsx`

در هدر پنل Brain (خط 283-287)، بین عنوان "Vizzy Brain" و دکمه "Analyze Now"، یک کامپوننت ساعت زنده اضافه می‌شود:

- آیکون `Clock` از lucide-react
- نمایش ساعت فعلی Toronto با فرمت `h:mm:ss AM/PM`
- لیبل `ET` کنار ساعت
- آپدیت هر ثانیه با `setInterval`
- استفاده از `useWorkspaceSettings` برای timezone
- استایل: متن کوچک (`text-xs`)، رنگ `text-muted-foreground`، با یک خط جداکننده `|` یا فاصله از عنوان

```text
┌──────────────────────────────────────────────────┐
│ 🧠 Vizzy Brain (118)  🕐 2:35:12 PM ET   [Analyze Now] ✕ │
└──────────────────────────────────────────────────┘
```

### جزئیات فنی
- `useState` + `useEffect` با `setInterval(1000)` برای آپدیت هر ثانیه
- `formatDateInTimezone` از `dateConfig.ts` با `timeZone` از workspace settings
- Cleanup interval در return useEffect

