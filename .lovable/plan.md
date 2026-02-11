

## Update ELEVENLABS_AGENT_ID Secret

### What we'll do
Update the `ELEVENLABS_AGENT_ID` secret with your new agent ID (`agent_2601kh594s8tes1v8axk4c9vg7x7`), then redeploy and test the Voice Vizzy connection.

### Steps

1. **Update the secret** -- Replace `ELEVENLABS_AGENT_ID` with `agent_2601kh594s8tes1v8axk4c9vg7x7`
2. **Redeploy** the `elevenlabs-conversation-token` edge function
3. **Test** the function to confirm a valid conversation token is returned (no more 502 or agent_not_found errors)

### Technical details
- The secret update will be done via the secrets tool
- No code changes are needed -- the edge function already reads `ELEVENLABS_AGENT_ID` from environment variables
- Once the token endpoint works, the Voice Vizzy mic button (visible only to sattar@rebar.shop) will connect successfully

