

# Translate All Persian Text to English in Ad Director

## Summary
Replace all Persian/Farsi strings across the ad-director editor with English equivalents. This affects 8 files with ~50 Persian strings (dialog titles, labels, placeholders, toast messages, tooltips).

## Files & Changes

### 1. `src/components/ad-director/editor/AudioPromptDialog.tsx`
| Line | Persian | English |
|------|---------|---------|
| 72 | موسیقی | Music |
| 73 | موسیقی را تولید کنید یا فایل صوتی آپلود کنید. | Generate music or upload an audio file. |
| 79 | تولید با AI | Generate with AI |
| 82 | آپلود فایل | Upload File |
| 89 | پرامپت | Prompt |
| 99 | مدت زمان | Duration |
| 109 | در حال تولید... / تولید موسیقی | Generating... / Generate Music |
| 131 | فایل موسیقی را بکشید و رها کنید یا کلیک کنید | Drag and drop a music file or click to browse |
| 151 | افزودن به تایم‌لاین | Add to Timeline |

### 2. `src/components/ad-director/editor/VoiceoverDialog.tsx`
| Line | Persian | English |
|------|---------|---------|
| 49 | تولید صدای گوینده | Generate Voiceover |
| 56 | متن را وارد کنید تا خوانده شود... | Enter text to be spoken... |
| 61 | صدا | Voice |
| 75 | سرعت | Speed |
| 87 | حداکثر ۵۰۰۰ کاراکتر • صدای قبلی جایگزین می‌شود | Max 5000 characters • Replaces previous voiceover |
| 91 | انصراف | Cancel |
| 94 | در حال تولید... / تولید صدا | Generating... / Generate Voice |

### 3. `src/components/ad-director/editor/TextVoiceDialog.tsx`
| Line | Persian | English |
|------|---------|---------|
| 56 | ویرایش متن و صدا | Edit Text & Voice |
| 61 | متن روی ویدئو و صدای گوینده | Video text overlay & voiceover |
| 65 | متن را وارد کنید... | Enter text... |
| 71 | صدا | Voice |
| 85 | سرعت | Speed |
| 97 | متن جدید به‌عنوان زیرنویس روی ویدئو و صدای گوینده تولید می‌شود | New text will be added as subtitle and voiceover |
| 101 | انصراف | Cancel |
| 104 | در حال تولید... / تولید متن و صدا | Generating... / Generate Text & Voice |

### 4. `src/components/ad-director/editor/SubtitleDialog.tsx`
| Line | Persian | English |
|------|---------|---------|
| 40 | افزودن زیرنویس | Add Subtitle |
| 47 | متن زیرنویس را وارد کنید... | Enter subtitle text... |
| 52 | زیرنویس در پایین ویدئو نمایش داده می‌شود | Subtitle will appear at the bottom of the video |
| 56 | انصراف | Cancel |
| 57 | افزودن زیرنویس | Add Subtitle |

### 5. `src/components/ad-director/editor/ImageOverlayDialog.tsx`
| Line | Persian | English |
|------|---------|---------|
| 44 | افزودن تصویر به ویدئو | Add Image to Video |
| 48 | تصویر روی صحنه ... قرار می‌گیرد. پس از افزودن، آن را با درگ جابجا کنید. | Image will be placed on scene X. Drag to reposition after adding. |
| 51 | انتخاب تصویر | Select Image |

### 6. `src/components/ad-director/editor/SpeedControlPopover.tsx`
| Line | Persian | English |
|------|---------|---------|
| 33 | سرعت پخش ویدئو | Video Playback Speed |

### 7. `src/components/ad-director/editor/TimelineBar.tsx`
| Line | Persian | English |
|------|---------|---------|
| 581 | بازسازی کامل (فیلم، صدا، متن) | Regenerate All (Video, Audio, Text) |

### 8. `src/components/ad-director/ProVideoEditor.tsx` — All toast messages
| ~Line | Persian | English |
|-------|---------|---------|
| 260 | در حال بهینه‌سازی پرامپت با هوش مصنوعی... | Enhancing prompt with AI... |
| 282 | در حال تولید صدا... | Generating audio... |
| 316 | صدا با موفقیت تولید شد | Audio generated successfully |
| 319 | خطا در تولید صدا | Audio generation failed |
| 336 | فایل صوتی اضافه شد | Audio file added |
| 370 | صدای گوینده با موفقیت تولید شد | Voiceover generated successfully |
| 373 | خطا در تولید صدا | Voiceover generation failed |
| 381 | زیرنویس اضافه شد | Subtitle added |
| 442 | متن و صدا با موفقیت تولید شد | Text & voice generated successfully |
| 445 | خطا در تولید متن و صدا | Text & voice generation failed |
| 941 | برش ممکن نیست / نشانه‌گر را به وسط صحنه منتقل کنید | Cannot split / Move playhead to the middle of the scene |
| 973 | صحنه برش خورد / برش در ... | Scene split / Split at ... |
| 994 | برش ممکن نیست / ویدئویی برای این صحنه وجود ندارد | Cannot trim / No video for this scene |
| 1003 | برش ممکن نیست / مدت زمان بسیار کوتاه است | Cannot trim / Duration too short |
| 1021 | صحنه برش خورد / مدت جدید: ... | Scene trimmed / New duration: ... |
| 1023 | خطا در برش / برش ویدئو با خطا مواجه شد | Trim failed / Video trimming error |
| 1460 | در حال تولید موسیقی... | Generating music... |
| 1489 | موسیقی ساخته شد | Music generated |
| 1492 | موسیقی ساخته نشد / ادامه بدون موسیقی | Music generation failed / Continuing without music |
| 1496 | موسیقی ساخته نشد | Music generation failed |
| 1501 | تولید کامل شد / X ترک صدا و موسیقی ساخته شد | Generation complete / X audio & music tracks created |
| 1608 | صدای گوینده بازسازی شد | Voiceover regenerated |

## Approach
- Direct string replacement in each file — no structural changes
- All 8 files edited in parallel

