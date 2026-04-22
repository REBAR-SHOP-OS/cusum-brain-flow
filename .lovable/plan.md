

# تست‌های واحد برای واحد طول در Foreman Instructions

## هدف
تأیید این‌که `computeForemanDecision` در ماژول `cut`:
1. وقتی `source_total_length_text = "60""` باشد → instructions و recommendation عبارت `60"` را نشان دهند، نه `60 mm`.
2. وقتی `source_total_length_text = "2'-6""` باشد → همان متن ft-in نمایش داده شود.
3. وقتی `source_total_length_text = null` باشد → fallback به `<cut_length_mm> mm` کار کند.

## فایل جدید
**`src/lib/foremanBrain.test.ts`** — کنار خود ماژول.

## ساختار تست
```ts
import { describe, it, expect } from "vitest";
import { computeForemanDecision, type ForemanContext } from "./foremanBrain";
import type { StationItem } from "@/hooks/useStationData";

function makeItem(over: Partial<StationItem>): StationItem { /* defaults: cut_length_mm=1524, total_pieces=100, completed=0, bar_code="15M", phase="cutting", ... */ }

function makeCtx(item: StationItem): ForemanContext { /* module:"cut", machineStatus:"running", canWrite:true, selectedStockLength:12000, maxBars:10, lots/floorStock/wipBatches:[], currentIndex:0, ... */ }
```

سه `it` block:

- **inches**: item با `source_total_length_text: '60"'` → `instructions[0].emphasis === '60"'` و `recommendation` شامل `cut at 60"` (و **نباید** شامل `60 mm`).
- **ft-in**: `source_total_length_text: `2'-6"`` → `instructions[0].emphasis === `2'-6"`` و recommendation شامل همان رشته.
- **mm fallback**: `source_total_length_text: null`, `cut_length_mm: 750` → `instructions[0].emphasis === '750 mm'` و recommendation شامل `cut at 750 mm`.

برای هر تست بررسی می‌شود `decision.instructions.length >= 1` و `decision.runPlan?.feasible !== false` (با manualFloorStockConfirmed=true تا blocker موجودی فعال نشود و instructionها تولید بشوند).

## آنچه دست نمی‌خورد
- `src/lib/foremanBrain.ts` (تستِ صرفاً read-only علیه contract موجود).
- هیچ هوک، کامپوننت، schema یا config دیگر.
- `vitest.config.ts` و `src/test/setup.ts` (از قبل آماده‌اند، الگو منطبق با `src/test/*.test.ts` موجود).

## اعتبارسنجی
- `vitest run src/lib/foremanBrain.test.ts` → سه تست سبز.
- اگر روزی hardcode `mm` به foremanBrain برگردد، تست‌های inches و ft-in قرمز می‌شوند.

