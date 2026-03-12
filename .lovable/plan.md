

# Fix: Convert Persian Labels to English in Visual Themes

The visual theme chips and their section label are currently in Persian. Per the project's language standard, all UI text must be English only.

## Changes — `src/components/social/ImageGeneratorDialog.tsx`

### 1. Update `VISUAL_THEMES` labels (lines 8-16)
| Current (Persian) | New (English) |
|---|---|
| پرنده | Birds |
| ساختمان | Building |
| پروژه ساختمانی | Construction |
| شهر | City |
| طبیعت | Nature |
| کارگران | Workers |
| هوش مصنوعی | AI & Build |
| محصولات ما | Our Products |

### 2. Update section label (line 241)
Change `تم‌های تصویری` → `Visual Themes`

No other files affected. Two small edits in one file.

