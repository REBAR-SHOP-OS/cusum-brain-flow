

## مشکل ریشه‌ای: extract-manifest بوت نمی‌شود

### علت
لاگ‌های edge function خطای زیر را نشان می‌دهند:

```
worker boot error: Uncaught SyntaxError: The requested module
'https://deno.land/std@0.190.0/encoding/base64.ts' does not provide
an export named 'encode'
```

**خط ۳** فایل `supabase/functions/extract-manifest/index.ts`:
```typescript
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
```

در نسخه `0.190.0` استاندارد Deno، ماژول `encoding/base64.ts` export به نام `encode` ندارد. این باعث می‌شود function اصلاً بوت نشود و هر درخواست با "Failed to send a request to the Edge Function" رد شود.

### راه‌حل

**فایل**: `supabase/functions/extract-manifest/index.ts`

خط ۳ را تغییر می‌دهیم تا از API داخلی Deno (`btoa`/`Uint8Array`) استفاده کند — بدون وابستگی به std:

```typescript
// حذف خط 3 (import encode)
// جایگزین با تابع ساده:
function base64Encode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}
```

یا استفاده از نسخه صحیح std:
```typescript
import { encodeBase64 as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
```

هر دو روش مشکل را حل می‌کند. روش دوم (std@0.224.0) با بقیه پروژه سازگارتر است.

### فایل درگیر
| فایل | تغییر |
|---|---|
| `supabase/functions/extract-manifest/index.ts` | اصلاح import base64 در خط ۳ |

### نتیجه
بعد از این تغییر، edge function بوت می‌شود و Extraction دوباره کار خواهد کرد.

