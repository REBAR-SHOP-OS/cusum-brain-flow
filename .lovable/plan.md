
## درک درخواست
الآن وقتی کاربر در `CharacterPromptDialog` متن می‌نویسد و **"Save direction"** می‌زند، متن در state داخلی character ذخیره می‌شود ولی **در textarea اصلی "Describe the ad..."** پر نمی‌شود. در نتیجه دکمه‌ی **Create video** غیرفعال می‌ماند (چون آن دکمه با خالی بودن prompt اصلی disabled است).

کاربر می‌خواهد:
- وقتی Save direction زده می‌شود → متن character به‌صورت خودکار در textarea اصلی (`prompt` / "Describe the ad...") قرار بگیرد
- در نتیجه دکمه‌ی **Create video** فعال شود
- ویدیو بر اساس آن character و دیالوگش ساخته شود

## بررسی
نیاز به خواندن:
- `ChatPromptBar.tsx` — جای render شدن `CharacterPromptDialog` و state اصلی `prompt`
- محل handler مربوط به `onSave` در dialog
- نحوه‌ی محاسبه‌ی `disabled` بودن دکمه‌ی Create video

## برنامه (Surgical, Single-File)

### تغییر فقط در `src/components/ad-director/ChatPromptBar.tsx`

#### handler `onSave` در `<CharacterPromptDialog>`
به‌جای فقط ذخیره‌کردن متن character در state داخلی، **متن character را در prompt اصلی هم بنویسد**:

```ts
onSave={() => {
  const trimmed = characterPromptText.trim();
  if (trimmed) {
    // متن character را به prompt اصلی منتقل کن (replace کامل)
    onPromptChange(trimmed);
    // یا اگر prompt قبلی موجود باشد، append:
    // const merged = prompt.trim() ? `${prompt.trim()}\n\n${trimmed}` : trimmed;
    // onPromptChange(merged);
  }
  setCharacterDialogOpen(false);
}}
```

**رفتار پیشنهادی (انتخاب نهایی):**
- اگر textarea اصلی **خالی** بود → متن character کامل در آن نوشته می‌شود
- اگر textarea اصلی **متن داشت** → متن character به آخر آن append می‌شود (با `\n\n` فاصله) تا کاربر آنچه قبلاً نوشته را از دست ندهد

این انتخاب امن‌تر و non-destructive است (مطابق Surgical Execution Law).

#### نتیجه‌ی فعال شدن دکمه‌ی Create video
چون در ChatPromptBar شرط `disabled` دکمه Create video به `prompt.trim().length > 0` وابسته است، با پر شدن خودکار prompt، دکمه فعال می‌شود — **بدون نیاز به هیچ تغییر دیگری**.

#### حفظ state داخلی character
`characterPromptText` و indicator سبز کنار دکمه‌ی Character (همان `•`) دست‌نخورده می‌ماند تا کاربر بداند character direction ذخیره شده است.

## آنچه تغییر نمی‌کند
- `CharacterPromptDialog.tsx` — بدون تغییر (همان onSave callback را صدا می‌زند)
- منطق generation و edge functions — بدون تغییر
- AI Prompt dialog و سایر dialogها — بدون تغییر
- Style/Products/Duration/Engine — بدون تغییر

## نتیجه
بعد از کلیک روی **Save direction**:
1. متن character direction به textarea اصلی منتقل می‌شود
2. دکمه‌ی **Create video** فوراً فعال می‌شود
3. کاربر می‌تواند مستقیماً Create video بزند و ویدیو بر اساس character reference + دیالوگ ساخته شود
