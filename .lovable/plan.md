

# Add Camera Intelligence Card to Automations Section

## What Changes

Add a new card to the `defaultAutomations` array in `src/components/integrations/AutomationsSection.tsx` for Camera Intelligence, styled consistently with the existing cards.

### Details

- **New entry** in `defaultAutomations` after "ad-director":
  - `id`: `"camera-intelligence"`
  - `name`: `"Camera AI"`
  - `description`: `"Vision & dispatch intelligence for shop floor"`
  - `color`: `"teal"` (green-teal gradient to differentiate from the red/orange video cards)
  - `icon`: needs a new icon type — add `"camera"` mapping using `Camera` from lucide-react
  - `route`: `"/shopfloor/camera-intelligence"`

- **Update `iconComponents`** to add `camera: Camera` mapping
- **Update `Automation` type** to include `"camera"` in the `icon` union

### Files Modified
- `src/components/integrations/AutomationsSection.tsx` — add icon type, icon mapping, and new card entry

