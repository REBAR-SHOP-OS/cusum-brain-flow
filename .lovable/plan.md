

# افزودن آیکون‌های محصولات به نوار ورودی Pixel

## خلاصه
ردیف دوم آیکون‌های رنگی و درشت‌تر برای ۷ محصول اضافه می‌شود. وقتی کاربر محصولی را انتخاب کند، تصاویر تولیدشده آن محصول را تبلیغ می‌کنند. همچنین عکس‌های واقعی محصولات از Brain خوانده شده و به عنوان reference به مدل تصویرساز ارسال می‌شوند.

## محصولات و آیکون‌ها

| محصول | آیکون | رنگ | کلید |
|---|---|---|---|
| Rebar Fiberglass Straight | 🟢 Cylinder | سبز | `fiberglass` |
| Rebar Stirrups | 🟠 Square | نارنجی | `stirrups` |
| Rebar Cages | 🔵 Box | آبی | `cages` |
| Rebar Hooks | 🟡 Anchor | زرد | `hooks` |
| Rebar Dowels | 🔴 ArrowDownUp | قرمز | `dowels` |
| Wire Mesh | 🟣 Grid3x3 | بنفش | `wire_mesh` |
| Rebar Straight | ⚪ Minus | خاکستری | `straight` |

## تغییرات

### 1. `src/components/chat/ChatInput.tsx`
- آرایه `PRODUCT_ICONS` با ۷ محصول و آیکون‌های Lucide رنگی
- Props جدید: `selectedProducts?: string[]` و `onSelectedProductsChange?`
- ردیف دوم آیکون‌ها زیر style icons (فقط در `minimalToolbar`) با آیکون‌های بزرگ‌تر (`w-5 h-5`) و رنگی
- هر آیکون toggleable با رنگ مخصوص خودش

### 2. `src/pages/AgentWorkspace.tsx`
- State: `selectedProducts: string[]`
- پاس به ChatInput + ارسال در `extraContext.selectedProducts`

### 3. `supabase/functions/ai-agent/index.ts`
- خواندن `context.selectedProducts`
- `PRODUCT_PROMPT_MAP` برای ترجمه کلید به توضیح دقیق محصول برای prompt
- وقتی محصولات انتخاب شده: slot product را override می‌کند و تمرکز تصویر روی آن‌ها می‌گذارد
- جستجوی عکس‌های واقعی محصولات از knowledge table و ارسال به عنوان reference

### 4. `supabase/functions/regenerate-post/index.ts`
- همسان‌سازی: اگر `selectedProducts` در context بود، در imagePrompt تزریق شود

### فایل‌ها
- `src/components/chat/ChatInput.tsx`
- `src/pages/AgentWorkspace.tsx`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

