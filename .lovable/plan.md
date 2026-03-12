

## Update DashScope API Key

### The Problem
The `DASHSCOPE_API_KEY` secret stored in your project is still invalid — DashScope returns "Invalid API-key provided" when Wan 2.1 tries to generate video.

### What Needs to Happen
I need to switch to implementation mode to use the `add_secret` tool to prompt you for the new key value. The key must be from the **DashScope International** console and should start with `sk-`.

### Steps
1. Use `add_secret` to request the updated `DASHSCOPE_API_KEY` value
2. You paste the correct key from [DashScope International Console](https://dashscope-intl.console.aliyun.com/) → API Keys
3. Redeploy the `generate-video` edge function

### Where to Find Your Key
- Go to https://dashscope-intl.console.aliyun.com/
- Navigate to **API Keys** section
- Copy an active key (starts with `sk-`)

No code changes needed — just the secret value update.

