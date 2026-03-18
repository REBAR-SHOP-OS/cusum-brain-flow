

## Plan: Translate Pixel Agent Cards to English

### Problem
The two action cards on the Pixel agent welcome screen contain Persian text, violating the English-only UI policy.

### Change — `src/pages/AgentWorkspace.tsx` (lines 752-765)

Replace the Persian text in both cards:

**Card 1 (line 752-753):**
- `💬 ساخت عکس با چت` → `💬 Create Images via Chat`
- `هر چیزی که می‌خواهید بنویسید، عکس ساخته می‌شود` → `Describe anything and get an image generated`

**Card 2 (line 764-765):**
- `📋 ساخت عکس براساس دستور عمل` → `📋 Create Images from Recipe`
- `۵ پست آماده برای محصولات مختلف` → `5 ready-made posts for different products`

Single file, 4 string replacements.

