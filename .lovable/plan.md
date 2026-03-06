

# Add "Kiosk Status" Tab to Time Clock

## What
Add a new tab called **"وضعیت کیوسک"** (Kiosk Status) next to the existing tabs (Team Status, My Leave, Team Calendar, Payroll). This tab will show people currently present (clocked in) at the company.

## Changes

### File: `src/pages/TimeClock.tsx`

1. **Add icon import**: Add `Monitor` from lucide-react (line 15)

2. **Add new TabsTrigger** (after line 363, before `</TabsList>`):
   ```tsx
   <TabsTrigger value="kiosk-status" className="flex-1 gap-1.5">
     <Monitor className="w-3.5 h-3.5" /> وضعیت کیوسک
   </TabsTrigger>
   ```

3. **Add new TabsContent** showing only clocked-in profiles with a clean card layout displaying:
   - Avatar with green indicator
   - Full name
   - Clock-in time and elapsed duration
   - A header showing total count of present employees

