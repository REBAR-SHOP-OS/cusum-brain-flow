

## Add Personal Notes/Storage Space for Each @rebar.shop User

### Problem
Users want a personal space within Team Hub to save notes, text, and information privately.

### Changes

**Database Migration** — Create `user_notes` table:
```sql
CREATE TABLE public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notes"
  ON public.user_notes FOR ALL TO authenticated
  USING (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));
```

**File**: `src/components/teamhub/PersonalNotes.tsx` (NEW)
- A panel component showing user's saved notes as a list
- Create, edit, delete notes with title + rich text content
- Auto-save on blur or after a short debounce
- Search/filter notes by title

**File**: `src/components/teamhub/ChannelSidebar.tsx`
- Add a "My Notes" item (with `StickyNote` icon) in the sidebar, above CHANNELS section
- When clicked, set a special selection mode (e.g. `onSelect("__my_notes__")`)

**File**: `src/pages/TeamHub.tsx`
- Detect when `activeChannelId === "__my_notes__"` and render `<PersonalNotes>` instead of `<MessageThread>`
- Pass `myProfile` to `PersonalNotes`

**File**: `src/hooks/usePersonalNotes.ts` (NEW)
- CRUD hook using `@tanstack/react-query` for `user_notes` table
- `useNotes(profileId)` — fetch all notes for user
- `createNote`, `updateNote`, `deleteNote` mutations

### UI Layout
```
Sidebar:                    Main Area (when "My Notes" selected):
┌──────────────────┐       ┌─────────────────────────────────────┐
│ [Avatar] Team Hub│       │  My Notes          [+ New Note]     │
│ [Search...]      │       │─────────────────────────────────────│
│                  │       │  📝 Meeting recap    Mar 24         │
│ 📝 My Notes     │◄──    │  📝 Project ideas    Mar 23         │
│                  │       │  📝 TODO list        Mar 22         │
│ CHANNELS         │       │─────────────────────────────────────│
│ # Official Chan. │       │  [Selected note editor area]        │
│ ...              │       │  Title: [____________]              │
└──────────────────┘       │  Content: [___________________]     │
                           └─────────────────────────────────────┘
```

| File | Change |
|---|---|
| DB Migration | Create `user_notes` table with RLS |
| `src/hooks/usePersonalNotes.ts` | NEW — CRUD hook for notes |
| `src/components/teamhub/PersonalNotes.tsx` | NEW — Notes list + editor panel |
| `src/components/teamhub/ChannelSidebar.tsx` | Add "My Notes" sidebar item |
| `src/pages/TeamHub.tsx` | Render PersonalNotes when selected |

