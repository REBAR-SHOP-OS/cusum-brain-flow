

## Add AI Video Generator Card to Automations Section

Add a new automation card for the Video Studio in `src/components/integrations/AutomationsSection.tsx`.

### Changes

**File: `src/components/integrations/AutomationsSection.tsx`**

Add a new entry to `defaultAutomations` array:

```typescript
{
  id: "video-generator",
  name: "AI Video Studio",
  description: "Generate videos, images & audio with AI",
  enabled: true,
  color: "purple",
  icon: "video",  // new icon type
  route: "/video-studio",
}
```

- Add `Video` from lucide-react to imports
- Add `"video": Video` to the `iconComponents` map
- Update the `Automation` type's `icon` union to include `"video"`
- Place it after "Automations Hub" so it appears in the bottom-right slot of the grid

No new files needed. Single file edit.

