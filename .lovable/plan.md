

## Update ElevenLabs API Key and Test Voice Vizzy

### Step 1: Update the ELEVENLABS_API_KEY secret
Replace the existing `ELEVENLABS_API_KEY` secret with the new key you provided (now with ElevenLabs Agents Write permission enabled).

### Step 2: Redeploy the edge function
Redeploy the `elevenlabs-conversation-token` edge function to pick up the updated secret.

### Step 3: Test the connection
Call the edge function to verify the 502 error is resolved and a valid conversation token is returned.

