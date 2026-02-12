
# Auto-Activate AI Voice When Call Connects

## Goal
When any agent (Penny, Vizzy, Forge) initiates a call, the AI should **automatically take over the conversation** as soon as the call connects -- no manual "AI Talk" button click needed.

## Current Problem
Right now the flow is: Agent suggests call -> User clicks "Call Now" -> Call connects to user's computer -> User has to manually click "AI Talk" -> Then AI starts speaking. The user wants the AI to start speaking immediately.

## Implementation

### 1. Add a `callWithAi` method to `useWebPhone`
Create a new method in the WebPhone hook that combines dialing + auto-bridging. When called, it will:
- Dial the number as usual
- Listen for the call "established"/"accepted" event on the session
- Automatically trigger the AI bridge (`startBridge`) as soon as the remote party picks up

### 2. Update `PennyCallCard` to auto-bridge on call
- Change the "Call Now" button behavior: when the call card has AI bridge props, clicking "Call Now" will automatically activate the AI bridge once the call is connected
- Remove the manual "AI Talk" button (or keep it as a fallback toggle)
- Use a `useEffect` that watches `callStatus` -- when it transitions to `in_call`, automatically start the bridge

### 3. Make it work for all agents
- The `useCallAiBridge` hook is already generic
- Each agent component (Penny, Vizzy, Forge) just needs to pass the appropriate context string when calling

## Technical Details

### File changes:

**`src/components/accounting/AccountingAgent.tsx`**
- Add an effect: when `webPhoneState.status` changes to `"in_call"`, automatically call `startBridge()` with the pending call's context
- Store the pending call data (contact name, reason) so the bridge knows what context to send

**`src/components/accounting/PennyCallCard.tsx`**
- Add a `useEffect` that watches `callStatus` -- when it becomes `"in_call"` and bridge is not yet active, automatically trigger `onStartAiBridge`
- Keep the "Stop AI" / "AI Talk" button as a manual override toggle
- Change default label from "AI Talk" to indicate AI will auto-activate

**`src/hooks/useWebPhone.ts`**
- Add an `"established"` or `"accepted"` event listener on the call session to ensure we detect when the remote party actually picks up (not just when dialing starts)
- This ensures the AI bridge only activates after the call is truly connected

### Flow after changes:
1. User tells Penny "call Sattar and ask him to come to office"
2. Penny outputs the call card with reason
3. User clicks "Call Now"
4. WebPhone dials the number
5. When the remote party picks up (status -> `in_call`), the AI bridge **automatically activates**
6. Penny's AI voice starts talking to the person
7. User can click "Stop AI" to take over manually if needed
