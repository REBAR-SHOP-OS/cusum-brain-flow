
## درک درخواست
کاربر می‌خواهد در همان نوار پایین (کنار دکمه‌ی "AI Prompt")، یک **آیکون جدید** اضافه شود که مخصوص نوشتن **prompt اختصاصی برای Character** باشد — یعنی متنی که شخصیت باید بگوید/انجام دهد. مشابه دکمه‌ی AI Prompt اما scope آن فقط character است.

## بررسی لازم
خواندن:
- `ChatPromptBar.tsx` — جای دکمه‌ی AI Prompt
- `AIPromptDialog.tsx` — برای الگوبرداری dialog
- state container که `characterImageUrl` در آن نگهداری می‌شود (احتمالاً `useAdDirector` یا مشابه)

## برنامه (Surgical, Additive)

### ۱. افزودن state جدید
در همان hook که `characterImageUrl` را نگه می‌دارد:
```ts
characterPrompt: string  // متن اختصاصی character
setCharacterPrompt: (v: string) => void
```

### ۲. افزودن دکمه‌ی آیکون در `ChatPromptBar.tsx`
کنار دکمه‌ی "AI Prompt"، یک دکمه‌ی کوچک با آیکون `UserSquare` (یا `MessageSquareQuote`) اضافه می‌شود:
- **Disabled** اگر `characterImageUrl` وجود نداشته باشد (با tooltip: "Upload a character first")
- **فعال + dot indicator** اگر prompt قبلاً نوشته شده
- کلیک → باز شدن dialog جدید `CharacterPromptDialog`

```tsx
<Button
  variant="outline" size="sm"
  disabled={!characterImageUrl}
  onClick={() => setCharacterDialogOpen(true)}
>
  <UserSquare className="h-4 w-4" />
  Character
  {characterPrompt && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
</Button>
```

### ۳. ساخت `CharacterPromptDialog.tsx` (الگوگرفته از `AIPromptDialog`)
- Textarea با placeholder: "What should the character say or do? e.g. 'Introduce our company REBAR SHOP and invite viewers to request a quote.'"
- Preview thumbnail کوچک از character image در بالای dialog
- پشتیبانی RTL خودکار (همان `detectRtl`)
- دکمه‌ی "✨ Improve with AI" که با Lovable AI (`google/gemini-3-flash-preview`) متن را cinematic و promotional می‌کند
- دکمه‌های "Cancel" و "Save"

### ۴. تزریق در پایپلاین generation
در `backgroundAdDirectorService.ts` در همان نقطه‌ای که `characterImageUrl` چک می‌شود، اگر `characterPrompt` تعریف شده، آن را به‌عنوان **override برای narrationLine** همه scene‌های middle (که از character استفاده می‌کنند) اعمال می‌کند — یا حداقل به prompt تکمیلی اضافه می‌شود تا Wan2.6-i2v بداند شخصیت چه کاری انجام دهد:

```ts
const enhancedPrompt = characterPrompt
  ? `${scene.prompt}\n\nCharacter action/dialogue: ${characterPrompt}`
  : scene.prompt;
```

و در فاز voiceover (در پیاده‌سازی بعدی)، اگر `characterPrompt` موجود باشد، **به‌جای** narrationLine هر scene از این متن استفاده می‌شود.

### ۵. Persistence
- ذخیره در همان رکورد `ad_projects` (ستون جدید `character_prompt text` با migration)
- بازیابی هنگام Resume draft

## آنچه تغییر نمی‌کند
- دکمه‌ی AI Prompt و dialog آن — بدون تغییر
- ReferenceUploadCard و آپلود character image — بدون تغییر
- منطق force I2V (همان فاز قبل) — بدون تغییر

## نتیجه
کنار دکمه‌ی AI Prompt یک آیکون "Character" ظاهر می‌شود. وقتی کاربر یک character آپلود کند، این دکمه فعال می‌شود و با کلیک یک dialog باز می‌کند که می‌تواند متن اختصاصی برای دیالوگ/عملکرد آن شخصیت بنویسد. این متن در همه scene‌های مربوط به character اعمال می‌شود.
