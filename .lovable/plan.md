
# Fix: Replace Persian Placeholder Text with English in AnnotationOverlay

## Problem
In `src/components/feedback/AnnotationOverlay.tsx` (line 366), the `Textarea` placeholder is hardcoded in Persian:
```
"توضیح تغییر مورد نیاز را بنویسید یا با میکروفون بگویید..."
```
This violates the rule that all app UI text must remain in English. Only AI chat responses should adapt to the user's language.

## Fix
Change the placeholder to English:
```
"Describe the change needed, or use the microphone..."
```

## Scope
- **File:** `src/components/feedback/AnnotationOverlay.tsx`
- **Line:** 366 only
- No other files, logic, or components touched.
