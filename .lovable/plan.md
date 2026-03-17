

## مشکل: دراپ‌داون تغییر واحد طول (mm/cm/m/in/ft) نمایش داده نمی‌شود

### ریشه مشکل
کد unit selector وجود دارد (خطوط 278-295) ولی در grid سه‌ستونه، فضای کافی برای نمایش هر دو دراپ‌داون (source column + unit) در یک ردیف نیست و دراپ‌داون واحد کلیپ/مخفی می‌شود.

### راه‌حل
ساختار ردیف "Cut Length" را تغییر دهیم تا unit selector در خط دوم زیر دراپ‌داون اصلی نمایش داده شود، به جای اینکه در کنار آن باشد.

### تغییرات در `src/components/office/BarlistMappingPanel.tsx`

**ردیف‌های mapping (خطوط 252-297):**
- برای فیلد `length`، ساختار flex را به `flex-wrap` تغییر دهیم یا unit selector را به یک ردیف جداگانه زیر دراپ‌داون اصلی منتقل کنیم
- تبدیل container از `flex items-center` به `flex flex-wrap items-center` برای فیلد length
- یا بهتر: unit selector را به عنوان یک عنصر full-width زیر دراپ‌داون اصلی قرار دهیم با label "Source unit:"

### کد پیشنهادی
```tsx
{field.key === "length" && (
  <div className="w-full flex items-center gap-2 mt-1">
    <span className="text-[10px] text-muted-foreground">Source unit:</span>
    <Select value={lengthUnit} onValueChange={...}>
      <SelectTrigger className="h-7 text-xs w-[100px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LENGTH_UNITS.map(u => (
          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

### فایل‌ها
- `src/components/office/BarlistMappingPanel.tsx` — restructure length field layout

