

## تبدیل دکمه Chat به دکمه شناور قابل جابجایی (Draggable)

### توضیح
دکمه "Chat" که در حال حاضر ثابت در گوشه پایین-راست صفحه قرار دارد، به یک دکمه دایره‌ای شناور تبدیل می‌شود که کاربر بتواند آن را به هر جایی از صفحه بکشد و جابجا کند. موقعیت دکمه در localStorage ذخیره می‌شود تا بعد از رفرش حفظ شود.

### تغییرات

#### فایل: `src/components/chat/DockChatBar.tsx`

1. **اضافه کردن `useDraggablePosition` hook** — همان hook موجود که برای FloatingMicButton استفاده شده
2. **تبدیل دکمه launcher** از یک pill ثابت (`fixed bottom-0 right-4`) به یک دکمه دایره‌ای شناور با `left/top` داینامیک
3. **اتصال event handlers** (`onPointerDown`, `onPointerMove`, `onPointerUp`) به دکمه
4. **جلوگیری از کلیک بعد از drag** — اگر `wasDragged.current` باشد، Popover باز نشود
5. **استایل جدید**: دکمه دایره‌ای ~56px با آیکون Chat، `cursor-grab`, `touch-action: none`
6. **Popover** در موقعیت دکمه باز شود (بالای دکمه)

#### جزئیات فنی

```text
- storageKey: "dock-chat-pos"
- btnSize: 56
- defaultPos: گوشه پایین-راست (مشابه موقعیت فعلی)
- در onPointerDown: اگر Popover باز است ابتدا بسته شود
- در onClick/onPointerUp: فقط اگر drag نشده باشد، launcherOpen را toggle کند
- style: { position: fixed, left: pos.x, top: pos.y, touchAction: "none" }
```

### فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/chat/DockChatBar.tsx` | تبدیل launcher pill به دکمه دایره‌ای draggable با useDraggablePosition |

