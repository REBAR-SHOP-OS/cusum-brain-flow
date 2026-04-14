

## Plan: Add All Agents as Categorized Nodes in Architecture Diagram

### Problem
The top area of the architecture diagram (External Services layer) appears sparse. The user wants all 20+ named agents and their items shown in a categorized layout, so clicking any card reveals its relationships.

### Approach
Add all agents as nodes in the **AI / Automation** layer (where Vizzy and Nila already live), organized by department. Then add edges connecting each agent to its related modules, integrations, and external services.

### New Agent Nodes to Add (by department)

**Revenue Department:**
- Blitz (Sales) → connects to CRM, Pipeline
- Penny (Accounting) → connects to Accounting, QuickBooks
- Gauge (Estimating) → connects to Estimating, QA War
- Kala (Purchasing) → connects to Shop Floor

**Operations Department:**
- Forge (Shop Floor) → connects to Shop Floor, State Machine
- Atlas (Delivery) → connects to Shop Floor
- Relay (Email) → connects to Inbox, Gmail

**Support Department:**
- Haven (Support) → connects to Chat, Notifications

**Growth Department:**
- Pixel (Social) → connects to Social, Meta
- Seomi (SEO) → connects to SEO, SEO Engine
- Buddy (BizDev) → connects to CRM, Pipeline
- Commet (Web Builder) → connects to Website
- Penn (Copywriting) → connects to Email, Social
- Gigi (Growth) → connects to Pipeline
- Scouty (Talent) → connects to Team Hub
- Prism (Data) → connects to Analytics, Primary DB

**Special Ops:**
- Architect (Empire) → connects to Odoo, MCP

**Note:** Vizzy and Nila already exist as nodes — they stay as-is.

### Changes

**`src/lib/architectureGraphData.ts`**:
1. Add ~16 new agent nodes to `ARCH_NODES` in the `ai` layer with `violet` accent
2. Add ~30 new edges connecting agents to their related modules/integrations
3. Each agent node gets descriptive bullets showing its role and connections

**`src/lib/architectureFlow.ts`**:
- Increase `maxPerRow` from 10 to 12 (to fit more nodes per row in the AI layer)

### Result
- AI / Automation layer shows all agents organized in rows
- Single-clicking any agent reveals its connections to modules, integrations, and external services
- Single-clicking any module shows which agents connect to it
- All existing nodes, edges, and behavior preserved

