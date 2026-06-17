# Image Generation Recipe — "The REBAR.SHOP Look"

این سند کامل توضیح می‌دهد چرا عکس‌هایی که `supabase/functions/generate-image` تولید می‌کند کیفیت بالایی دارند و چگونه می‌توان همان دستور پخت را در هر اپ دیگری (Lovable، Node، Deno، Next.js …) پیاده کرد.

> منبع اصلی: `supabase/functions/generate-image/index.ts`
> فایل helper آماده کپی: `src/lib/imageGenRecipe/generateAdImage.ts`

---

## ۱. مدل پایه

```
provider: Lovable AI Gateway
endpoint: https://ai.gateway.lovable.dev/v1/chat/completions
model:    google/gemini-3-pro-image-preview
modalities: ["image", "text"]
auth header: Authorization: Bearer ${LOVABLE_API_KEY}
```

همین مدل را اگر «خام» صدا بزنی، خروجی معمولی و illustration-مانند می‌دهد. آنچه آن را تبدیل به عکس تبلیغاتی photorealistic می‌کند **چهار لایه‌ی زیر** است.

---

## ۲. چهار لایه‌ی کیفیت

### لایه ۱ — رفرنس بصری از Pexels (مهم‌ترین تک قدم)

قبل از فراخوانی مدل، یک عکس واقعی از Pexels با کلیدواژه‌های پرامپت می‌گیریم و به‌عنوان `image_url` همراه پرامپت می‌فرستیم. این تنها چیزی است که خروجی را از CGI/illustration به photorealistic می‌کشاند.

```ts
GET https://api.pexels.com/v1/search?query=<prompt>&per_page=1
header: Authorization: <PEXELS_API_KEY>
→ photos[0].src.large
```

اگر کلید Pexels نداری، helper بدون آن هم کار می‌کند ولی کیفیت محسوسا افت می‌کند.

### لایه ۲ — پرامپت ساختاریافته با قوانین سخت

پرامپت در چند بلوک ساخته می‌شود؛ ترتیب و کلمات «MUST / FORBIDDEN / MANDATORY» مدل را حبس می‌کند.

```
PHOTOREALISTIC ADVERTISING IMAGE — <BRAND>

ABSOLUTE RULES:
- ALL images MUST be PHOTOREALISTIC — real-world professional photography style ONLY.
- Natural lighting, real textures, real materials, real environments.
- ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract, clip-art.
- MANDATORY CANVAS: <ASPECT>  (e.g. "9:16 vertical portrait STORY, 1080×1920")
- Feature <BRAND> products prominently in the scene.
- Clean, professional, visually striking.

Use the provided reference image as visual inspiration for composition and style.
Suggested visual style: <RANDOM STYLE FROM LIST>

User request: <USER PROMPT>

Brand tagline: "<TAGLINE>"
Value proposition: <VALUE_PROP>
About: <DESCRIPTION>

MANDATORY ADVERTISING BANNER FORMAT — THIS IMAGE IS A COMPANY AD:
- Designed as a professional ADVERTISING BANNER (billboard / magazine ad / social promo).
- MUST contain BAKED-IN, perfectly legible TEXT directly on the image.
- REQUIRED text elements:
    1) A bold HEADLINE / slogan (max 6 words) in the upper third, billboard-style.
    2) A clear WORDMARK strip with the brand name "<BRAND>" in clean bold sans-serif.
    3) A short CALL-TO-ACTION line (e.g. "Call …", "Visit …", "Order Today").
- Typography rules: clean bold sans-serif, high contrast, professionally kerned, perfectly spelled,
  NO lorem ipsum, NO gibberish, NO duplicated words.
- ALL text MUST be in ENGLISH ONLY. NO Persian/Arabic/Cyrillic anywhere.
- NO stock-site watermarks, NO photographer credits.
- A photo with NO baked-in advertising text is a FAILURE — output MUST look like a finished ad banner.
- If a logo image is provided, render it EXACTLY as-is as a visible part of the design — NOT a tiny corner watermark.
```

#### ۱۲ سبک بصری چرخشی

هر بار یکی به‌صورت تصادفی انتخاب می‌شود تا فید یکنواخت نشود:

```
1.  Construction site with workers using rebar products, golden hour lighting
2.  Warehouse product display — neat stacks of rebar stirrups and ties on metal shelving
3.  Macro close-up of rebar stirrups showing texture, sharp focus, bokeh background
4.  Drone aerial view of a construction project with rebar grids being placed
5.  Urban infrastructure — bridges, overpasses, high-rises with visible rebar framework
6.  Before-and-after raw rebar vs finished reinforced concrete
7.  Industrial workshop — bending machine shaping rebar with sparks, dramatic lighting
8.  Clean studio product shot — rebar accessories on concrete surface
9.  Delivery truck loaded with bundled rebar arriving at a construction site
10. Engineer inspecting rebar installation on-site with blueprints in hand
11. Split composition — steel rebar on left, finished structure on right
12. Rain-soaked construction site with glistening rebar grids, moody atmosphere
```

برای صنعت دیگر این لیست را بازنویسی کن (مثلا برای کافه: "Pour-over coffee bar, morning light"، …).

### لایه ۳ — Brand Context + Logo + رفرنس محصول

`messages[0].content` یک آرایه‌ی multi-modal است:

```jsonc
[
  { "type": "text", "text": "<the full ad prompt above>" },
  { "type": "image_url", "image_url": { "url": "<pexels reference>" } },
  { "type": "image_url", "image_url": { "url": "<brand logo>" } },
  { "type": "text",      "text": "Render this company logo prominently and clearly … NOT a tiny corner watermark." },
  { "type": "image_url", "image_url": { "url": "<real product photo 1>" } },
  { "type": "image_url", "image_url": { "url": "<real product photo 2>" } },
  { "type": "text",      "text": "The above resource images show real products — match the real product appearance." }
]
```

تا ۳ عکس رفرنس محصول کافی است؛ بیشتر، مدل را گیج می‌کند.

### لایه ۴ — Post-processing سرور

حتی با قید 9:16 در پرامپت، Gemini گاهی square تحویل می‌دهد. خروجی را با crop سرور به ابعاد دقیق برسان:

```
Story / Reels:  1080×1920  (9:16)
Feed Post:      1080×1080  (1:1)
Banner:         1920×1080  (16:9)
```

از `cropToAspectRatioStrict` در `supabase/functions/_shared/imageResize.ts` استفاده می‌کنیم. در اپ دیگر می‌توانی از `sharp` (Node) یا یک canvas helper استفاده کنی.

---

## ۳. ساختار request کامل

```ts
POST https://ai.gateway.lovable.dev/v1/chat/completions
Authorization: Bearer <LOVABLE_API_KEY>
Content-Type: application/json

{
  "model": "google/gemini-3-pro-image-preview",
  "modalities": ["image", "text"],
  "messages": [
    { "role": "user", "content": [ ...contentParts... ] }
  ]
}
```

## ۴. استخراج عکس از response

اولویت اول، فیلد ساختاریافته:

```ts
const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
```

Fallback (گاهی مدل base64 را داخل متن می‌چسباند):

```ts
const content = data.choices?.[0]?.message?.content ?? "";
const m = typeof content === "string"
  && content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
if (m) imageUrl = m[0];
```

## ۵. Retry بر 429 و 402

- `429` (rate-limit) → exponential backoff تا ۵ تلاش، شروع از 3s، سقف 20s.
- `402` (credits exhausted) → بدون retry، خطا را به کاربر نشان بده.
- بقیه‌ی 5xx → یک بار retry، بعد خطا.

## ۶. چک‌لیست انتقال به اپ دیگر

- [ ] `LOVABLE_API_KEY` به‌عنوان secret سرور (هرگز client).
- [ ] (اختیاری ولی توصیه‌شده) `PEXELS_API_KEY` رایگان از pexels.com/api.
- [ ] فایل `generateAdImage.ts` را کپی کن (یا از روی این سند بازنویسی کن).
- [ ] لیست ۱۲ سبک بصری را برای صنعت خودت بازنویسی کن.
- [ ] متن `brandContext` خودت را بساز (`business_name`, `tagline`, `value_prop`, `description`).
- [ ] لوگوی شرکت را روی یک URL عمومی (Storage / CDN) قرار بده.
- [ ] post-processing crop به ابعاد رسانه‌ی مقصد.
- [ ] تست با ۳ prompt متفاوت و تأیید چشمی خروجی.

نمونه‌ی کد آماده در `src/lib/imageGenRecipe/generateAdImage.ts` و فراخوانی نمونه در `docs/image-generation-recipe.example.ts`.
