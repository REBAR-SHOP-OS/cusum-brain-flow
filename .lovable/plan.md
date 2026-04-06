

# Fix: Vizzy Stops Talking After 4-5 Turns + Build Error

## Two Issues

### Issue 1: Vizzy Goes Silent After ~5 Exchanges

**Root Cause**: OpenAI Realtime API has a context window limit. Vizzy's system prompt is massive (~430 lines of instructions + full ERP data digest). After 4-5 voice turns, the conversation context fills up and the model stops generating audio responses — it silently fails without an error event.

**Fix**: Implement a sliding conversation window that automatically deletes old conversation items from the Realtime session after accumulating more than 6 items (3 user + 3 agent turns). When a new `response.done` arrives, count conversation items and send `conversation.item.delete` for the oldest pairs, keeping the session context lean.

#### File: `src/hooks/useVoiceEngine.ts`

1. Add a `conversationItemIds` ref to track all item IDs received from the Realtime API
2. Listen for `conversation.item.created` events to capture item IDs
3. After each `response.done`, if items exceed 6, delete the oldest items via `conversation.item.delete` data channel messages
4. This keeps the context window fresh — system prompt stays, but old turns are pruned

```text
Flow:
  Turn 1: user_item_1, agent_item_1  (2 items)
  Turn 2: user_item_2, agent_item_2  (4 items)
  Turn 3: user_item_3, agent_item_3  (6 items)
  Turn 4: user_item_4, agent_item_4  (8 items → delete items 1-2 → 6 items)
  ...always keeps last 3 exchanges
```

### Issue 2: Build Error in ArchFlowNode.tsx

**Root Cause**: `@xyflow/react` v12+ changed the `NodeProps` generic — it now expects `Node<DataType>` not just `DataType`. The component passes `ArchFlowNodeData` directly which doesn't satisfy the `Node` constraint.

**Fix**: Change `NodeProps<ArchFlowNodeData>` to `NodeProps` and manually type `data` from the destructured props, or use the correct generic form `NodeProps<Node<ArchFlowNodeData>>`.

#### File: `src/components/system-flow/ArchFlowNode.tsx` (line 42)

Change the function signature to use the correct typing pattern for @xyflow/react v12+:
```typescript
function ArchFlowNodeInner(props: NodeProps) {
  const data = props.data as ArchFlowNodeData;
  const { id, selected } = props;
```

## Impact
- Vizzy can now sustain unlimited conversation turns without going silent
- Old conversation context is pruned server-side, keeping responses fast
- Transcripts in the UI are NOT affected — they remain in React state for display
- Build error is fixed with correct typing
- No other features affected

## Files Changed
- `src/hooks/useVoiceEngine.ts` — add conversation item tracking + auto-pruning
- `src/components/system-flow/ArchFlowNode.tsx` — fix NodeProps typing

