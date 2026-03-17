

# Add Persian Event Info on Click

## What
When a user clicks on an event card in the Monthly Event Calendar, a popover/dialog appears showing a brief Persian description of that event — what the day is about, its significance, and how it relates to the business.

## Changes

### 1. `src/components/social/ContentStrategyPanel.tsx` — Update `EventCard`
- Add a `useState` toggle or use a `Popover` component to show/hide info on click
- Store a `persianInfo` map (keyed by event name) with short Persian descriptions for all 32 events
- On click, show a small popover below the card with the Persian text (RTL styled)
- Use existing `Popover` + `PopoverTrigger` + `PopoverContent` from shadcn

### 2. Persian descriptions map — inline constant
A `Record<string, string>` mapping each event name to a 1-2 sentence Persian explanation. Examples:
- `"New Year's Day"` → `"آغاز سال نوی میلادی — فرصتی برای تعیین اهداف جدید و برنامه‌ریزی پروژه‌های ساختمانی سال آینده."`
- `"Nowruz (Persian New Year)"` → `"نوروز، جشن باستانی آغاز بهار — نماد نوسازی و شروعی تازه در پروژه‌های عمرانی."`
- `"International Women's Day"` → `"روز جهانی زن — گرامیداشت نقش زنان در صنعت ساخت‌وساز و حرفه‌های فنی."`
- All 32 events will have Persian descriptions

### Implementation detail
- The `EventCard` becomes clickable (cursor-pointer)
- Clicking opens a `Popover` with RTL-directed Persian text
- The popover has a subtle background, rounded corners, and closes on outside click

## Files
| File | Change |
|------|--------|
| `src/components/social/ContentStrategyPanel.tsx` | Add Persian info map, wrap `EventCard` in Popover |

