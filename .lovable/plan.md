

# End-to-End Plan Status: User-Based AI Persona System

## COMPLETED (Already Built and Deployed)

### 1. User-to-Agent Mapping Utility
- **File**: `src/lib/userAgentMap.ts` -- DONE
- Maps `sattar@rebar.shop` to Vizzy (CEO), `kourosh@rebar.shop` to Forge (Shop Floor), `ben@rebar.shop` to Gauge (Estimator)

### 2. Home Page Personalization
- **File**: `src/pages/Home.tsx` -- DONE
- Role-specific hero text, quick actions, and helper card ordering per user

### 3. Agent Config Enhancement
- **File**: `src/components/agent/agentConfigs.ts` -- DONE
- Forge: "Shop Floor Commander" greeting with cage-build and maintenance capabilities
- Vizzy: CEO-specific capabilities added

### 4. AgentWorkspace Auto-Briefing
- **File**: `src/pages/AgentWorkspace.tsx` -- DONE
- Proactive briefings triggered when mapped users open their primary agent

### 5. Edge Function Prompt Engineering
- **File**: `supabase/functions/ai-agent/index.ts` -- DONE and DEPLOYED
- Forge: cage fabrication instructions, maintenance tracking, operator management prompts
- Vizzy: CEO executive mode with exception-based reporting and health scores
- Context fetcher pulls machine_runs, cut_plans, accounting_mirror data

---

## NOT YET STARTED (Approved but Waiting on You)

### 6. Synology NAS WebDAV Integration
- **Status**: Plan approved, but blocked -- needs your NAS to be set up and reachable
- **What's needed from you**:
  1. Enable WebDAV Server on your Synology (Package Center, port 5006 HTTPS)
  2. Set up external access (static IP, Synology DDNS, or reverse proxy)
  3. Create a `/rebar-files/drawings/` folder
  4. Provide three values: WebDAV URL, username, password
- **What we'll build once ready**:
  - `supabase/functions/synology-upload/index.ts` -- proxy uploads to NAS
  - `supabase/functions/synology-download/index.ts` -- proxy downloads from NAS
  - Update `src/lib/storageUtils.ts` with routing logic (files >20MB or .dwg/.dxf go to Synology)
  - Update `ChatInput.tsx` to auto-route large files

---

## WHAT TO DO NOW

The persona system (items 1-5) is fully built. To verify it works:

1. **Log in as sattar@rebar.shop** -- Home should show "CEO Command" hero and executive quick actions
2. **Log in as kourosh@rebar.shop** -- Home should show "Forge" hero and shop floor quick actions
3. **Open the Agent Workspace** for your role -- should get a proactive briefing
4. **Ask Forge a question** like "How do I build a cage for this drawing?" to test the enhanced prompt

For Synology (item 6): set up your NAS with WebDAV access, then tell me "My Synology is ready" and I'll build it immediately.

