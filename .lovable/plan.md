

## Retry Edge Function Deployment

The error is a temporary network failure (connection reset to esm.sh) during the bundling step. The `notify-lead-assignees` function code is correct and doesn't even import from esm.sh directly — the error comes from a transitive dependency in the shared `requestHandler.ts`.

### Action
Simply redeploy the `notify-lead-assignees` edge function. No code changes needed.

