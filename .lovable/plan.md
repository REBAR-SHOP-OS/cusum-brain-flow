

## Plan: Translate Recipe Table to English + Ensure Immediate Image Generation on Slot Click

### Problem
1. The recipe table (headers, product names, themes, buttons) is entirely in Persian — violates English-only UI policy.
2. When clicking a slot's "ساخت" button, the message sent is `"Content schedule for today"` which is vague and may cause the agent to narrate instead of immediately generating. It should send a direct, unambiguous generation command.

### Changes

**`src/pages/AgentWorkspace.tsx` (lines 690-739)**

Translate the entire recipe table to English and change the button click message to be more direct:

- Table headers: `ساعت` → `Time`, `موضوع` → `Theme`, `محصول` → `Product`, `عملیات` → `Action`
- Row data:
  - `۶:۳۰` → `06:30`, `انگیزشی / قدرت` → `Motivational / Power`, `خاموت میلگرد` → `Stirrups`
  - `۷:۳۰` → `07:30`, `تبلیغاتی خلاقانه` → `Creative Promo`, `کیج میلگرد` → `Cages`
  - `۸:۰۰` → `08:00`, `استحکام و مقیاس` → `Strength & Scale`, `میلگرد فایبرگلاس` → `GFRP`
  - `۱۲:۳۰` → `12:30`, `نوآوری و بهره‌وری` → `Innovation`, `مش سیمی` → `Wire Mesh`
  - `۲:۰۰` → `14:00`, `تبلیغ محصول` → `Product Promo`, `دوبل میلگرد` → `Dowels`
- Button text: `ساخت` → `Generate`
- Button click message: `"Content schedule for today"` → `"Generate slot {N} now"` (direct command the agent recognizes immediately)
- Title `دستور عمل تولید محتوا` → `Content Generation Recipe`
- Back button `بازگشت` → `Back`
- Bulk button `ساخت همه اسلات‌ها` → `Generate All Slots`
- Text alignment: change `text-right` to `text-left` (LTR English)

### Single file change
- `src/pages/AgentWorkspace.tsx`

