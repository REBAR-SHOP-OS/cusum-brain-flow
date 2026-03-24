

## Update Official Group Description to English

### Problem
The "Official Group" channel description is stored in Persian (`گروه رسمی برای همه اعضای شرکت`) in the database. Per the English-only UI standard, it should be in English.

### Change

**Database Migration** — Update the description:
```sql
UPDATE public.team_channels
SET description = 'Official group for all team members'
WHERE name = 'Official Group';
```

Single migration, no code changes needed.

| Change | Detail |
|---|---|
| DB Migration | Update Official Group description to English |

