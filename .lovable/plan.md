

## Update DashScope API Key

The current `DASHSCOPE_API_KEY` is invalid — edge function logs confirm repeated `401 InvalidApiKey` errors from DashScope.

### What needs to happen
Use the `add_secret` tool to prompt you for the new correct API key value. The key should be from the **DashScope International** console (https://dashscope-intl.console.aliyun.com/) and typically starts with `sk-`.

### Steps
1. Call `add_secret` to request the updated `DASHSCOPE_API_KEY` value from you
2. You paste in the correct key
3. Redeploy the `generate-video` edge function so it picks up the new secret

No code changes needed — just the secret value update and redeployment.

