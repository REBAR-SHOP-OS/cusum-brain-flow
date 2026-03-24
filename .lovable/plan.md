

## Channel Write Restrictions + Group Open Chat

### What
1. **Channel "کانال رسمی شرکت"**: Only `radin@rebar.shop`, `sattar@rebar.shop`, `neel@rebar.shop` can write. Everyone else sees messages but the composer is hidden (read-only).
2. **Group "گروه رسمی شرکت"**: All `@rebar.shop` users can read and write (already working).

### Changes

#### 1. `src/components/teamhub/MessageThread.tsx`
- Add `readOnly?: boolean` to `MessageThreadProps`
- When `readOnly` is true, hide the entire composer section (lines 612-720) and show a small "Read-only channel" notice instead

#### 2. `src/pages/TeamHub.tsx`
- Determine if active channel is the official channel ("کانال رسمی شرکت")
- Check if current user's email is in the allowed writers list (`radin@rebar.shop`, `sattar@rebar.shop`, `neel@rebar.shop`)
- Pass `readOnly={true}` to `MessageThread` when channel is official AND user is not an allowed writer

```typescript
const CHANNEL_WRITERS = ["sattar@rebar.shop", "radin@rebar.shop", "neel@rebar.shop"];
const isOfficialChannel = activeChannel?.name === "کانال رسمی شرکت";
const canWrite = !isOfficialChannel || CHANNEL_WRITERS.includes(myProfile?.email ?? "");
// Pass readOnly={!canWrite} to MessageThread
```

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Add `readOnly` prop, hide composer when true |
| `src/pages/TeamHub.tsx` | Compute write permission, pass `readOnly` to MessageThread |

