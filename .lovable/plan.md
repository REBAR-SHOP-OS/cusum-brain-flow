

## Rename Channel & Group to English

### What
Rename "کانال رسمی شرکت" → **"Official Channel"** and "گروه رسمی شرکت" → **"Official Group"** — both in the database and all code references.

### Changes

#### 1. Database migration
```sql
UPDATE public.team_channels SET name = 'Official Channel' WHERE name = 'کانال رسمی شرکت';
UPDATE public.team_channels SET name = 'Official Group' WHERE name = 'گروه رسمی شرکت';
```

#### 2. Code references

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Replace `"کانال رسمی شرکت"` → `"Official Channel"`, `"گروه رسمی شرکت"` → `"Official Group"` |
| `src/pages/TeamHub.tsx` | Replace `"کانال رسمی شرکت"` → `"Official Channel"` in the write-restriction check |

