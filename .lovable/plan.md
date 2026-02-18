
# Odoo-Style Floating Chat Window — UI Reskin of DockChatBox

## Scope: ONE File Only
**`src/components/chat/DockChatBox.tsx`** — pure visual reskin.  
Zero changes to: database, hooks, context, DockChatBar, routing, other pages, or any logic.

---

## What the Reference Image Shows (Odoo Style)

From the screenshot:
- **White card** background (not dark), soft `box-shadow`, `border-radius` on top corners
- **Header**: coloured left-side avatar circle with initials + online indicator dot, bold contact name, then phone / minimize (–) / close (×) icons spaced to the right
- **Messages**: rendered as **chat bubbles** — own messages right-aligned in a teal/primary colour, other person's messages left-aligned in a light grey. Each bubble has rounded corners with the "tail" corner flat on the conversation side
- **Timestamps**: shown as small grey text above groups of messages (e.g. "11 days ago", "12 days ago") — date separators between day groups
- **Composer**: full-width input at the bottom reading "Message [Name]..." with emoji, paperclip, and mic icons inline

---

## Precise Changes to `DockChatBox.tsx`

### 1. Message Bubble Layout (replaces current list)
Current: every message is a left-aligned row with avatar + name + text.  
New:
- `isMe` messages → `ml-auto`, right-aligned, primary-coloured bubble (`bg-primary text-primary-foreground`), rounded `rounded-2xl rounded-br-sm`
- Other messages → `mr-auto`, left-aligned, muted bubble (`bg-muted text-foreground`), rounded `rounded-2xl rounded-bl-sm`
- Avatar shown only for OTHER person's messages (left side), hidden for own
- Sender name shown only in group channels above the first bubble of a sequence
- Timestamp shown small and dim below each bubble

### 2. Date Separators
Group messages by date. Insert a centred date label (e.g. "February 6, 2026") between day groups — matching the Odoo separator style exactly.

### 3. Header Reskin
Current: coloured bar with channel icon + name + 3 icon buttons  
New (Odoo-style):
- White/card background header (not full primary colour — use a subtle border-bottom instead)
- Left: coloured `Avatar` circle (using the same `getAvatarColor` already in the file) with initials + small green online dot
- Centre: bold contact name in dark text, small "Online" or channel type label underneath
- Right: expand icon, minimize `–`, close `×` — each 20×20 touch targets, text-muted-foreground on hover

### 4. Minimized Tab
Keep same behaviour, just match header styling (white pill with avatar + name, not full-width primary bar).

### 5. Composer
Current: small `<input>` with clip + send buttons.  
New: full-width textarea-style input with `placeholder="Message {channelName}..."`, paperclip left, send right — same Odoo layout.

### 6. Container
- Change from `bg-card border border-border` → `bg-white dark:bg-card shadow-2xl border border-gray-200 dark:border-border`
- Width stays `320px`
- Add `rounded-t-xl` (slightly more rounded than current `rounded-t-lg`)

---

## What is NOT Changed
- No hook changes (`useTeamMessages`, `useSendMessage`, etc.)
- No database changes
- No context changes (`DockChatContext`)
- `DockChatBar.tsx` — not touched
- All other pages — not touched
- All logic (file upload, drag-and-drop, send, realtime subscription) — preserved exactly
- No new dependencies

---

## Technical Details

### Date separator helper (pure function, inside component file)
```typescript
function formatDateSeparator(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}
```

### Grouping logic
```typescript
// Build groups: [{date: string, msgs: Message[]}]
const grouped = messages.reduce((acc, msg) => {
  const d = new Date(msg.created_at).toDateString();
  const last = acc[acc.length - 1];
  if (!last || last.date !== d) acc.push({ date: d, dateLabel: formatDateSeparator(msg.created_at), msgs: [msg] });
  else last.msgs.push(msg);
  return acc;
}, [] as { date: string; dateLabel: string; msgs: typeof messages }[]);
```

### Bubble classes (no new dependencies)
```typescript
const bubbleClass = isMe
  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm ml-auto"
  : "bg-muted text-foreground rounded-2xl rounded-bl-sm mr-auto";
```

All styling uses existing Tailwind classes already present in the project.
