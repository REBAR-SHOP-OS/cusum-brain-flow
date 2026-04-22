

# اصلاح نمایش واحد در دستورالعمل‌های Foreman (mm → unit واقعی)

## تشخیص واقعی

فایل `src/features/shopfloor/components/TagDetails.tsx` در پروژه وجود ندارد و هیچ ضرب در `25.4` در نمایش طول مارک انجام نمی‌شود. باگ واقعی که در اسکرین‌شات قرمز شده ("60 mm" در پنل Foreman) از این جا می‌آید:

- **`src/lib/foremanBrain.ts`** خطوط ۴۴۶ و ۴۸۰: متن دستورالعمل و پیشنهاد روی طول‌ها به‌شکل hardcode عبارت `mm` می‌چسباند.
- در حالی که فیلد `cut_length_mm` در DB طبق memory `import-unit-detection` مقدار **خام در واحد منبع** را نگه می‌دارد (در این مارک: `60` به اینچ — همان عددی که کارت بزرگ "Cut Each Piece To" با لیبل **IN** درست نشان می‌دهد).

نتیجه: کارت بزرگ درست است؛ فقط متن Foreman اشتباه `mm` می‌گذارد.

## تغییرات

### ۱. `src/lib/foremanBrain.ts`

اضافه کردن یک helper کوچک داخل ماژول:
```ts
function unitSuffix(item: StationItem): string {
  const t = item.source_total_length_text || "";
  if (t.includes('"') && t.includes("'")) return ' ft-in';
  if (t.includes('"')) return '"';      // inches
  if (t.includes("'")) return "'";      // feet
  return ' mm';
}
function lengthLabel(item: StationItem): string {
  return item.source_total_length_text || `${item.cut_length_mm} mm`;
}
```

سپس در دو نقطه:

- **خط ۴۴۶** — `emphasis: \`${item.cut_length_mm} mm\`` → جایگزینی با:
  ```ts
  emphasis: lengthLabel(item),
  ```

- **خط ۴۸۰** — جملهٔ `→ cut at ${item.cut_length_mm}mm →` → جایگزینی با:
  ```ts
  → cut at ${lengthLabel(item)} →
  ```

این کار باعث می‌شود وقتی `source_total_length_text` موجود باشد (مثلاً `60"`) همان نمایش داده شود و وقتی موجود نباشد، fallback امن `<عدد> mm` بماند تا روی داده‌های قدیمی regression رخ ندهد.

## آنچه دست نمی‌خورد

- محاسبات runPlan (`piecesPerBar`, `slots`, `remnant`) — همه با همان `cut_length_mm` خام ادامه می‌دهند (هیچ تبدیل واحدی در منطق محاسبه دست نمی‌خورد).
- کارت "Cut Each Piece To" (که همین الان درست است).
- لیبل "MM/IN/FT/FT-IN" روی همان کارت (که همین الان درست است).
- هیچ فایل DB / RLS / edge function / schema.
- هیچ فایل دیگر فرانت‌اند (`StationView.tsx`، `BenderStationView.tsx`، `ForemanPanel.tsx` همگی دست‌نخورده).

## اعتبارسنجی

1. `/shopfloor/station/<machineId>` با مارک A1501 (همان اسکرین‌شات): پنل Foreman باید بگوید **"Set stopper to 60""** و **"cut at 60" → 100 pieces"** (نه `60 mm`).
2. مارکی با داده‌های mm خالص (بدون `source_total_length_text`): همچنان "Set stopper to 750 mm" نمایش داده شود (fallback سالم).
3. هیچ خطای console و هیچ تغییری در شمارش‌ها / تعداد bar / remnant.

