

# Three Surgical Fixes

## 1. Product Picker in Create Transaction Dialog

The "Description" field in line items (circled in the screenshot) is currently a plain text input. It needs to become a searchable dropdown that lists all products from the `qb_items` table.

**File: `src/components/customers/CreateTransactionDialog.tsx`**

- Import `useQuickBooksData` or query `qb_items` directly via a small `useQuery` hook inside the component
- Filter items to `type = 'Service'` (skip Categories) and `is_deleted = false`
- Replace the Description `<Input>` with a Combobox (using `cmdk` which is already installed) that:
  - Shows all products in a searchable dropdown
  - On selection, auto-fills `description` with the item name and `unitPrice` with the item's `unit_price`
  - Still allows free-text typing for custom line items
- Guard: if `qb_items` query fails or returns empty, fall back to the current plain text input

## 2. Chat Layers on Top (Except Screenshot)

The DockChatBar, DockChatBox, and GlobalChatPanel all use `z-50`, which puts them at the same level as dialogs and other overlays. The screenshot button is at `z-[9999]`.

**Files to change (class only -- `z-50` to `z-[9998]`):**

- `src/components/chat/DockChatBar.tsx` (line 95) -- launcher pill
- `src/components/chat/DockChatBox.tsx` (lines 85, 105) -- minimized and expanded states
- `src/components/layout/GlobalChatPanel.tsx` (lines 102, 210) -- both views

This ensures chat sits above all dialogs/toasts but below the screenshot button.

## 3. File Attachments with Drag-and-Drop in Dock Chat

The DockChatBox currently has no file attachment support. The full Team Hub MessageThread already has file upload to the `team-chat-files` bucket, so we replicate that pattern.

**File: `src/components/chat/DockChatBox.tsx`**

- Add a file input (hidden) triggered by a Paperclip icon button next to the send button
- Add drag-and-drop zone on the chat box container (`onDragOver`, `onDrop` handlers)
- On file drop/select:
  - Upload to `team-chat-files` bucket via `supabase.storage`
  - Build `ChatAttachment[]` array with name, url (signed URL), type, size
  - Pass attachments to `sendMutation.mutateAsync`
- Add visual drop indicator (border highlight) when dragging over the chat box
- Guards: max file size 10MB, throttle upload (disable send while uploading), type-safe attachment serialization
- Show attached file names as removable chips above the input before sending

No new dependencies, no schema changes, no new tables.
