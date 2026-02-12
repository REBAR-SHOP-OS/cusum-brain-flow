

# Use RingCentral Extensions for Internal Team Calls

## What Changes
Right now, internal team calls use full phone numbers. In RingCentral, internal calls should use **extension numbers** instead -- this is faster, free (no PSTN charges), and the standard way to reach coworkers within the same RingCentral account.

## From the Screenshot -- Extension Directory
| Name | Extension | Phone |
|------|-----------|-------|
| Sattar Esmaeili | 101 | (416) 860-3608 |
| Vicky Anderson | 201 | (416) 860-3638 |
| Josh Anderson | 202 | (647) 259-8252 |
| Ben Rajabi Far | 203 | (647) 775-0698 |
| Saurabh Saurabh | 206 | (416) 640-0773 |
| Swapnil Mahajan | 209 | (647) 260-9403 |
| Radin Lachini | 222 | (647) 259-6837 |

## Implementation Steps

### 1. Update `useWebPhone.ts` -- Handle Extension Dialing
Modify the `call` function to detect short extension numbers (3-digit) and dial them differently. For RingCentral WebRTC, extensions are dialed as-is without stripping the `+` prefix or adding country codes.

### 2. Update Team Directory in `ai-agent/index.ts`
Replace phone numbers with extensions for internal team members. Update the prompt to instruct Penny and Vizzy to use the extension number (e.g., `"phone":"ext:101"`) for internal calls and full phone numbers for external/customer calls.

### 3. Update `PennyCallCard.tsx` -- Show Extension Info
Display "Ext. 101" instead of a phone number when the call target is an internal extension.

## Technical Details

**Files to modify:**
- `src/hooks/useWebPhone.ts` -- detect `ext:` prefix in phone number and dial as extension
- `supabase/functions/ai-agent/index.ts` -- update team directory with extensions, update prompt rules
- `src/components/accounting/PennyCallCard.tsx` -- display extension nicely in the UI

**Call format convention:**
- External: `+14168606118` (full number with country code)
- Internal: `ext:101` (extension prefix for detection in code)

