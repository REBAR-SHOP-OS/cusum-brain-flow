

## Diagnosis: Zahra's Face Recognition Issue

### Current State
- The face recognition pipeline (`face-recognize` edge function) already uses **only** `face_enrollments` as its source of truth — no avatars or other photos are used for matching.
- Every other enrolled user has exactly 3 active photos each (Behnam, Kourosh, Neel, Radin, Sattar, Saurabh, Tariq, Vicky).
- **Zahra Zokaei has zero enrollments** — no active, no inactive. She has never been enrolled.

### What Needs to Happen

**Step 1 — Enroll Zahra (Admin Action, not code)**
Someone with admin access must open the **Face Memory** panel on the TimeClock page, click "Add Person", select Zahra Zokaei, and capture 3 photos of her face from slightly different angles. This is the only fix needed.

**Step 2 — (Optional) Purge old inactive enrollment rows**
There are 22 inactive (soft-deleted) enrollment records for Radin (10), Saurabh (6), Sattar (3), and Ai (3). These are harmless (filtered by `is_active = true`) but can be permanently deleted via a migration for cleanliness:

```sql
DELETE FROM face_enrollments WHERE is_active = false;
```

### No Code Changes Required
The edge function and UI already enforce the correct behavior:
- Source of truth = `face_enrollments` table only
- Photos limited to 3 per person in the AI prompt (line 56)
- Avatars are only used for display after a match, never for recognition

### Action Required from You
Open the TimeClock page → Face Memory panel → Add Person → Select "Zahra Zokaei" → Capture 3 photos → Done.

