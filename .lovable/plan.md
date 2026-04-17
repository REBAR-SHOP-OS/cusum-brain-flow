
## مشکل فعلی

طبق تصویر، کاربر در `/ad-director` در حال regeneration scenes است. در حال حاضر:

1. **روی صفحه `/ad-director`** → overlay بزرگ پیشرفت دیده می‌شود ✅
2. **روی سایر صفحات** → یک floating indicator (`AdDirectorBackgroundIndicator`) قرار است نمایش داده شود
3. **اما** این indicator در دو حالت کلیدی **ظاهر نمی‌شود**:
   - وقتی کاربر روی scene draft قبلی کلیک می‌کند و missing scenes شروع به regenerate می‌کند (`handleSelectProjectDraft`)
   - وقتی کاربر در editor یک scene واحد را regenerate می‌کند (`service.regenerateScene`)

## ریشه‌ی باگ

در `src/lib/backgroundAdDirectorService.ts`:

| مسیر | `flowState: "generating"` | `this.running = true` |
|---|---|---|
| `runPipeline()` (ابتدای کار) | ✅ | ✅ خط 199 |
| `regenerateScene()` | ❌ | ❌ |
| `handleSelectProjectDraft` (در content) | ✅ | ❌ (فقط patchState) |

→ `isRunning()` در این دو مسیر `false` بازمی‌گرداند → `AdDirectorBackgroundIndicator` خط 52 هم `null` رندر می‌کند → کاربر از پیشرفت بی‌خبر می‌ماند.

## برنامه‌ی اصلاحی

### تغییر ۱: `src/lib/backgroundAdDirectorService.ts` — `regenerateScene`

در ابتدای متد (قبل از هر `update`) و در `finally` بعد از کامل شدن:

```ts
async regenerateScene(sceneId: string, customPrompt?: string): Promise<void> {
  // ... existing scene/segment lookup ...
  
  this.running = true;                              // ← NEW
  this.update({
    statusText: "Regenerating scene...",            // ← NEW
    progressValue: 10,                              // ← NEW
    finalVideoUrl: null,
    clips: this.state.clips.map(...)
  });
  
  try {
    // ... existing generation logic ...
  } catch (error) {
    // ... existing error handling ...
  } finally {                                        // ← NEW
    this.running = false;
    this.update({ statusText: "", progressValue: 100 });
  }
}
```

### تغییر ۲: `src/lib/backgroundAdDirectorService.ts` — افزودن متد `setRunning`

برای اینکه `handleSelectProjectDraft` بتواند running flag را از خارج تنظیم کند بدون breaking encapsulation:

```ts
/** Mark pipeline as running externally (for resume/recovery flows). */
setRunning(value: boolean) {
  this.running = value;
}
```

### تغییر ۳: `src/components/ad-director/AdDirectorContent.tsx` — `handleSelectProjectDraft`

پس از `service.patchState({ flowState: "generating", ... })` خط 251، اضافه شود:

```ts
service.setRunning(true);
```

> این فقط flag را روشن می‌کند تا indicator ظاهر شود. کد موجود که scene‌ها را regenerate می‌کند بدون تغییر باقی می‌ماند (خود `service.regenerateScene` در پایان `setRunning(false)` می‌شود — البته اینجا نیاز است وقتی همه‌ی regen-های batch تمام شدند flag پاک شود؛ قبلاً این batch توسط منطق دیگری مدیریت می‌شد، پس فعلاً flag را روشن می‌کنیم و در پایان آخرین scene regen خودکار false می‌شود).

### تغییر ۴: `src/components/ad-director/AdDirectorBackgroundIndicator.tsx` — حذف محدودیت route

تغییر از:
```ts
if (location.pathname === "/ad-director") return null;
```
به:
```ts
// Show on /ad-director ONLY when user is NOT on the in-page generating screen
// (when flowState is not "generating", the page doesn't show its own progress overlay,
//  so the floating indicator gives feedback consistently)
const onAdDirectorPage = location.pathname === "/ad-director";
const pageShowsOwnProgress = onAdDirectorPage && state.flowState === "generating" && state.progressValue < 100;
if (pageShowsOwnProgress) return null;
```

این منطق:
- اگر کاربر در `/ad-director` و flowState="generating" است → page overlay کافی است، floating indicator مخفی می‌شود (تا duplicate نباشد)
- اگر کاربر در `/ad-director` و flowState != "generating" است (مثلاً result, editing) ولی regeneration در پس‌زمینه‌ی editor در حال انجام است → floating indicator ظاهر می‌شود ✅
- اگر کاربر صفحه را ترک کرده → همیشه floating indicator ظاهر می‌شود ✅

## آنچه دست‌نخورده می‌ماند
- منطق pipeline، storyboard، clips
- UI editor، drag-and-drop، scene cards
- DB / RLS / edge functions
- subscribe/unsubscribe pattern
- toast پایان کار

## نتیجه پس از اصلاح
1. ✅ هنگام regen تک scene در editor: floating indicator با درصد پیشرفت روی همه‌ی صفحات نمایش داده می‌شود
2. ✅ هنگام انتخاب draft ناقص: indicator فعال می‌شود حتی اگر کاربر بلافاصله صفحه را ترک کند
3. ✅ روی `/ad-director` در حالت editor یا result، اگر pipeline در پس‌زمینه کار می‌کند، indicator floating دیده می‌شود
4. ✅ در حالت تولید اولیه روی `/ad-director`، فقط overlay صفحه دیده می‌شود (بدون duplicate)
5. ✅ Polling هر ۱ ثانیه در indicator، درصد و statusText را هم‌زمان به‌روز می‌کند
