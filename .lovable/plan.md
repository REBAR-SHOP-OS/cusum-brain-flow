

## درخواست کاربر
ویدئوی Veo 3.1 generate شد (از لاگ: `poll` status=completed و URL هم برگشت) ولی در preview هیچ چیز نمایش داده نمی‌شود — صفحه‌ی سیاه با player خالی.

## ریشه‌ی مشکل (Root Cause)
Response از `generate-video` edge function این بود:
```json
{
  "status": "completed",
  "videoUrl": "https://generativelanguage.googleapis.com/v1beta/files/b52l84tacgbz:download?alt=media",
  "needsGeminiAuth": true
}
```

این URL **نیاز به Gemini API key در header دارد**. وقتی مرورگر آن را به `<video src=...>` می‌دهد، بدون Authorization header request می‌زند → Google 401/403 برمی‌گرداند → ویدئو load نمی‌شود → preview سیاه می‌ماند.

در `VideoStudioContent.tsx` (خط 282-285) این کیس handle شده:
```ts
const needsProxy = data.needsAuth || data.needsGeminiAuth;
if (needsProxy) finalUrl = await proxyDownload(...); // blob with auth
```

ولی در **AdDirector pipeline** (`backgroundAdDirectorService.ts` خط 954-992 — `pollGeneration`)، کد فقط `result.videoUrl` را مستقیم ذخیره می‌کند و **هیچ بررسی‌ای روی `needsGeminiAuth` / `needsAuth` نمی‌کند**. URL خام Gemini ذخیره می‌شود → scene clip نمی‌تواند load شود → preview سیاه.

Edge function از قبل یک `action: "download"` دارد (خط 1169) که با service key auth می‌کند و blob یا URL عمومی (مثل Supabase Storage upload) برمی‌گرداند. فقط باید AdDirector از آن استفاده کند.

## برنامه (Surgical, Additive)

### ۱. افزودن helper `proxyAuthenticatedVideo` در `backgroundAdDirectorService.ts`
مشابه `proxyDownload` در VideoStudioContent:
```ts
private async proxyAuthenticatedVideo(provider: string, jobId: string, remoteUrl: string): Promise<string | null> {
  // فراخوانی edge function با action:"download" 
  // تبدیل response.blob() → object URL
  // اگر edge function خودش URL استوریج برگرداند (JSON)، همان را برگردان
  // fallback: remoteUrl
}
```

نکات:
- اولویت ۱: اگر response `Content-Type: application/json` بود و `{ url }` داشت → همان URL (Supabase Storage = persistent، قابل stitch)
- اولویت ۲: اگر binary blob بود → `URL.createObjectURL(blob)` (موقت، فقط برای همان session کار می‌کند — ولی export/stitch قبل از expiration انجام می‌شود)
- اولویت ۳ (fallback): برگرداندن `remoteUrl` اصلی (همان رفتار broken فعلی — بهتر از crash)

### ۲. اعمال در `pollGeneration` (خط 969-976)
```ts
if (result.status === "completed" || result.videoUrl || result.url) {
  let videoUrl = result.videoUrl || result.url;
  const needsProxy = (result as any).needsAuth || (result as any).needsGeminiAuth;
  if (needsProxy && videoUrl) {
    const proxied = await this.proxyAuthenticatedVideo(provider, generationId, videoUrl);
    if (proxied) videoUrl = proxied;
  }
  // ... ادامه‌ی ذخیره در clip
}
```

### ۳. Type augmentation برای response
`invokeEdgeFunction<{ status?, videoUrl?, url?, needsAuth?, needsGeminiAuth? }>` تا TypeScript هم راضی باشد.

### ۴. همان الگو در `regenerateScene` (اگر جدا poll دارد)
اگر `regenerateScene` هم از `pollGeneration` همین متد استفاده می‌کند → fix خودکار. اگر route مستقل دارد → همان check اعمال شود.

### ۵. Persist در DB (اختیاری ولی توصیه‌شده)
اگر download action خروجی JSON با `storagePath`/`publicUrl` داشته باشد (باید در edge function بررسی شود) → همان را در `ad_projects.clips[].videoUrl` ذخیره کنیم تا بعد از رفرش هم کار کند. اگر فقط blob برمی‌گرداند، blob URL موقت است — توصیه: edge function را تکمیل کنیم که Veo video را در Supabase Storage آپلود کند (مشابه Wan flow). بررسی می‌شود چه آپشن فعال است.

## فایل‌های تغییرکننده
- `src/lib/backgroundAdDirectorService.ts` — افزودن `proxyAuthenticatedVideo` + check `needsGeminiAuth/needsAuth` در `pollGeneration`
- (شرطی) `supabase/functions/generate-video/index.ts` — اگر `action:"download"` برای `veo` فقط blob برمی‌گرداند، آن را به آپلود در Storage و برگرداندن `{ url, uploaded:true }` تبدیل کنیم تا URL persistent شود

## آنچه دست‌نخورده می‌ماند
- UI editor, stitch pipeline, aspect ratio, undo/redo
- `VideoStudioContent.tsx` (از قبل درست کار می‌کند)
- Wan flow (از قبل Storage-uploaded URL برمی‌گرداند و نیاز به proxy ندارد)
- DB schema / RLS / سایر edge functions

## نتیجه
1. ✅ ویدئوی Veo 3.1 در preview AdDirector نمایش داده می‌شود
2. ✅ Export/stitch روی آن کار می‌کند (چون URL قابل fetch شده)
3. ✅ تغییرات در Wan و Sora بی‌اثر (فقط branch Veo/needsGeminiAuth)
4. ✅ Graceful fallback: اگر proxy fail شد، URL خام را می‌دهد (همان رفتار قبلی، بدتر نمی‌شود)
5. ✅ زبان UI: انگلیسی

