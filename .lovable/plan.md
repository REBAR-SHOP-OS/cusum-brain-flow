

## مشکل: کارت‌های unassigned جدا جدا نمایش داده می‌شوند

### علت
در `groupByPlatform` (خط 13 فایل `SocialCalendar.tsx`)، پست‌های unassigned با کلید `unassigned_${p.id}` گروه‌بندی می‌شوند — یعنی هر پست کلید یکتای خودش را دارد و هرگز گروهی نمی‌شود.

پست‌های غیر-unassigned با کلید `${platform}_${title}` گروه می‌شوند (مثلاً ×5) ولی unassigned از این منطق مستثنی شده.

### راه‌حل
خط 13 را اصلاح کنیم تا unassigned هم مثل بقیه پلتفرم‌ها با `title` گروه شود:

```typescript
// قبل:
const key = p.platform === "unassigned"
  ? `unassigned_${p.id}`
  : `${p.platform || "other"}_${p.title || p.id}`;

// بعد:
const key = `${p.platform || "other"}_${p.title || p.id}`;
```

### فایل تغییر
- `src/components/social/SocialCalendar.tsx` — خط 11-14: حذف شرط ویژه unassigned

### نتیجه
تمام پست‌ها (از جمله unassigned) بر اساس پلتفرم + عنوان گروه‌بندی شده و به صورت یک کارت واحد با badge ×N نمایش داده می‌شوند.

