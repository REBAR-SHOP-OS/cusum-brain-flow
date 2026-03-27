

# Fix: Face ID Kiosk Matches Everyone as "Radin"

## Root Cause

Three compounding issues:

1. **Radin has 15 enrolled photos** — 3x more than anyone else. The AI receives 5 reference photos for Radin vs 1-3 for others, creating strong visual bias.
2. **No enrollment cap enforcement** — The `kiosk-punch` auto-enrollment and `kiosk-register` keep adding photos without checking if the person already has 5+.
3. **Enrollments are not filtered by company** — `face-recognize` fetches ALL enrollments globally. Not an issue now (single company) but architecturally wrong.

## Plan

### 1. Clean up excess enrollments (database migration)
- Delete Radin's oldest enrollments beyond 5 (remove 10 of 15)
- This immediately rebalances the reference photo distribution

### 2. Fix `face-recognize/index.ts` — balance reference photos
- Limit to **max 3 photos per person** sent to the AI (not 5) — this keeps the prompt balanced and reduces token cost
- Add company filtering if `companyId` is provided in the request
- Strengthen the prompt: explicitly warn the AI that having more reference photos for one person does NOT mean a higher prior probability of match

### 3. Fix `kiosk-punch/index.ts` — enforce enrollment cap
- Before auto-enrolling a new photo, check current count
- Only enroll if count < 5 (currently the check exists but the threshold may not be enforced properly)

### 4. Fix `kiosk-register/index.ts` — enforce enrollment cap
- Before uploading a face photo, check if the profile already has 5+ enrollments
- Skip upload if cap reached

## Technical Details

### Database cleanup SQL
```sql
-- Delete oldest Radin enrollments beyond newest 5
DELETE FROM face_enrollments
WHERE id IN (
  SELECT id FROM face_enrollments
  WHERE profile_id = '5d948a66-619b-4ee1-b5e3-063194db7171'
  AND is_active = true
  ORDER BY created_at DESC
  OFFSET 5
);
```

### face-recognize prompt addition
Add to the system prompt:
```
- The number of reference photos per person varies. Do NOT let more reference photos bias you toward that person. Judge ONLY on facial feature similarity.
- Each person's identity is equally likely a priori.
```

### Enrollment cap check (shared pattern)
```typescript
const { count } = await supabase
  .from("face_enrollments")
  .select("*", { count: "exact", head: true })
  .eq("profile_id", profileId)
  .eq("is_active", true);
if ((count || 0) >= 5) {
  // Skip enrollment, cap reached
}
```

## Files Changed
- **Database migration** — delete excess enrollments for Radin
- `supabase/functions/face-recognize/index.ts` — cap to 3 photos per person in AI prompt, add anti-bias language
- `supabase/functions/kiosk-punch/index.ts` — verify enrollment cap is enforced correctly
- `supabase/functions/kiosk-register/index.ts` — add enrollment cap check before upload

## Expected Result
- AI receives equal number of reference photos per person (max 3)
- No single person dominates the reference set
- New enrollments stop at 5 per person
- Recognition accuracy improves immediately after cleanup

