

## AI Face Recognition Time Clock System

This plan adds camera-based facial recognition to the Time Clock, making punch-in/out fully automatic -- employees just stand in front of a camera/tablet and the system identifies them and punches them in or out.

---

### How It Works

1. **Enrollment**: Each employee captures 3 reference photos of their face (stored in a private storage bucket). Admin or the employee themselves can do this from the Time Clock page.

2. **Auto-Punch**: When an employee approaches the kiosk/device, they tap "Start" and the camera captures their face. The system sends the photo + all enrolled reference photos to Lovable AI (Gemini vision model) which identifies the person and returns a confidence score.

3. **Automatic Action**: If confidence is 95% or higher, the system auto-punches (in or out depending on current status). If lower, it asks the employee to confirm their identity manually.

---

### Database Changes

**New table: `face_enrollments`**
- `id` (uuid), `profile_id` (references profiles), `photo_url` (text -- URL in storage bucket), `enrolled_at` (timestamptz), `is_active` (boolean, default true)
- RLS: employees can manage their own enrollments, admins can manage all

**New storage bucket: `face-enrollments`**
- Private bucket (not public -- face data is sensitive)
- Authenticated users can upload to their own folder
- Organized as `face-enrollments/{profile_id}/photo-1.jpg`

---

### New Edge Function: `face-recognize`

Receives a base64 camera capture + the employee's company context. The function:
1. Fetches all active face enrollments for the company (photo URLs)
2. Sends the captured image + enrolled reference images to Lovable AI (Gemini vision) with a prompt like: *"Compare this photo against these enrolled employee faces. Return the profile_id of the matching person and a confidence score 0-100. If no match, return null."*
3. Returns `{ matched_profile_id, confidence, employee_name }`
4. If confidence >= 95, the client auto-triggers punch-in or punch-out
5. Logs the recognition attempt in the audit trail

---

### UI Changes

**File: `src/pages/TimeClock.tsx`**
- Add a "Face ID" mode toggle at the top (switches between manual punch and camera mode)
- In camera mode: show a full-screen camera viewfinder with a circular overlay
- Auto-capture every few seconds or on tap
- Show recognition result with employee name + confidence badge
- Auto-punch with a success animation if matched

**New components in `src/components/timeclock/`:**
- `FaceCamera.tsx` -- Camera viewfinder using browser MediaDevices API (`navigator.mediaDevices.getUserMedia`). Captures frames as JPEG base64.
- `FaceEnrollment.tsx` -- Enrollment flow: capture 3 photos, upload to storage, save references in `face_enrollments` table. Shows a guide overlay (face outline).
- `FaceRecognitionResult.tsx` -- Shows match result with avatar, name, confidence score, and auto-punch countdown.

**New hook: `src/hooks/useFaceRecognition.ts`**
- Manages camera stream lifecycle
- Handles capture + sends to `face-recognize` edge function
- Returns recognition state (idle/scanning/matched/failed)
- Auto-triggers clockIn/clockOut on successful match

---

### Enrollment Flow (for employees)

1. Employee goes to Time Clock page and taps "Enroll Face ID"
2. Camera opens with a face outline guide
3. Employee captures 3 photos (front, slight left, slight right)
4. Photos upload to private `face-enrollments` storage bucket
5. References saved in `face_enrollments` table
6. Employee is now enrolled and can use face recognition to punch

---

### Kiosk Mode

The existing Time Clock page gets a "Kiosk Mode" button (fullscreen, no navigation):
- Camera is always active
- Continuously scans for faces
- When a face is detected and matched, shows a greeting + auto-punches
- Returns to scanning after 5 seconds
- Perfect for a wall-mounted tablet at the shop entrance

---

### Security and Privacy

- Face photos stored in a **private** storage bucket (not publicly accessible)
- AI processing happens server-side only (edge function) -- no face data stays on client
- Recognition attempts are logged for audit
- Employees can delete their enrollment at any time
- Face data is never used for anything other than punch identification

---

### Technical Details

**Edge function details (`face-recognize`):**
- Uses `google/gemini-2.5-flash` (vision-capable, fast, cost-effective)
- Sends multipart content: captured image + up to 3 reference images per enrolled employee
- To keep payload manageable, fetches enrollment photos as signed URLs and passes them to the AI
- Returns structured output via tool calling (profile_id + confidence)

**Camera implementation:**
- Uses `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })`
- Captures frames to canvas, exports as JPEG base64 (compressed to ~100KB)
- Works on mobile (front camera) and desktop (webcam)

**config.toml addition:**
```toml
[functions.face-recognize]
verify_jwt = false
```

### File Summary

| Action | File |
|--------|------|
| Migration | `face_enrollments` table + `face-enrollments` storage bucket |
| New edge function | `supabase/functions/face-recognize/index.ts` |
| New component | `src/components/timeclock/FaceCamera.tsx` |
| New component | `src/components/timeclock/FaceEnrollment.tsx` |
| New component | `src/components/timeclock/FaceRecognitionResult.tsx` |
| New hook | `src/hooks/useFaceRecognition.ts` |
| Modified | `src/pages/TimeClock.tsx` (add face mode toggle + kiosk mode) |

