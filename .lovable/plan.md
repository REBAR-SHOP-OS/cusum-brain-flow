

## Problem

The DELIVERY and PICKUP toggle buttons on the Initialize Scope page currently only set a local state variable (`manifestType`). The user wants them to navigate directly to the Loading Station (`/shopfloor/loading`) or Pickup Station (`/shopfloor/pickup`).

## Fix

### `src/components/office/AIExtractView.tsx` (lines 688–703)

- Keep the `manifestType` state toggle (it's still used in the extract session record)
- Add `useNavigate` from react-router-dom
- On DELIVERY click: set `manifestType("delivery")` then `navigate("/shopfloor/loading")`
- On PICKUP click: set `manifestType("pickup")` then `navigate("/shopfloor/pickup")`

This makes the buttons dual-purpose: they tag the session type AND route the user to the correct station.

