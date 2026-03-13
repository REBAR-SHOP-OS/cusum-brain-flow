

# افزودن آیکون‌های سبک تصویر به نوار ورودی چت Pixel

## خلاصه
در نوار ورودی چت (جایی که کاربر پیام تایپ می‌کند)، یک ردیف آیکون‌های قابل انتخاب اضافه می‌شود. کاربر می‌تواند یک یا چند سبک را انتخاب کند و سبک‌های انتخاب‌شده به عنوان context به edge function ارسال و در image prompt تزریق می‌شوند.

## سبک‌ها و آیکون‌ها

| سبک | آیکون Lucide | کلید |
|---|---|---|
| واقع‌گرایی (Realism) | `Camera` | `realism` |
| شهر (Urban) | `Building2` | `urban` |
| ساخت و ساز (Construction) | `HardHat` | `construction` |
| هوش مصنوعی و مدرنیته (AI & Modern) | `Cpu` | `ai_modern` |
| طبیعت و آرامش (Nature) | `TreePine` | `nature` |
| تبلیغاتی (Advertising) | `Megaphone` | `advertising` |
| الهام‌بخش (Inspirational) | `Flame` | `inspirational` |

## تغییرات

### 1. `src/components/chat/ChatInput.tsx`
- اضافه کردن prop جدید: `imageStyles?: string[]` و `onImageStylesChange?: (styles: string[]) => void`
- در حالت `minimalToolbar` (فقط Pixel agent)، یک ردیف آیکون‌های chip-style بین model selector و spacer قرار می‌گیرد
- هر آیکون toggle-able است و با کلیک فعال/غیرفعال می‌شود (رنگ primary برای فعال)
- Tooltip فارسی/انگلیسی روی هر آیکون

### 2. `src/pages/AgentWorkspace.tsx`
- State جدید: `const [imageStyles, setImageStyles] = useState<string[]>([])`
- پاس دادن `imageStyles` و `onImageStylesChange` به هر دو `ChatInput`
- اضافه کردن `extraContext.imageStyles = imageStyles` در `handleSendInternal`

### 3. `supabase/functions/ai-agent/index.ts`
- خواندن `context.imageStyles` از body
- ساخت بلوک style directive از سبک‌های انتخاب‌شده و تزریق به `imagePrompt` (بعد از customInstructionsBlock و قبل از MANDATORY REALISM RULE)
- نگاشت هر کلید به یک توصیف دقیق تصویری:
  - `realism` → "Ultra-photorealistic, shot on professional DSLR, natural lighting, real textures"
  - `urban` → "Urban cityscape setting, modern architecture, street-level industrial aesthetics"
  - `construction` → "Active construction site, heavy machinery, steel structures, workers"
  - `ai_modern` → "Futuristic, tech-forward, clean geometric lines, digital integration with physical world"
  - `nature` → "Natural outdoor setting, greenery, calm atmosphere, sustainable construction"
  - `advertising` → "Commercial product photography, polished, bold text overlays, brand-forward"
  - `inspirational` → "Dramatic lighting, hero shot, empowering composition, golden hour"
- تقویت anti-duplicate: اضافه کردن `ABSOLUTELY NO DUPLICATES` به prompt همراه با timestamp seed

### 4. `supabase/functions/regenerate-post/index.ts`
- همسان‌سازی: خواندن `imageStyles` از context و تزریق به image prompt

### فایل‌های ویرایشی
- `src/components/chat/ChatInput.tsx`
- `src/pages/AgentWorkspace.tsx`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

