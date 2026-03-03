
## Goal
Make the ChatGPT MCP connector see and use the new bird’s-eye financial/write tools in the same session where you currently only see the original 9 tools.

## What I found
- The codebase **does include** the new tools in `supabase/functions/mcp-server/index.ts`:
  - `get_financial_summary`, `list_invoices`, `list_bills`, plus the other read/write additions.
- This project’s local function invocation path currently returns **function not found** for `mcp-server`, while your ChatGPT connector traffic is hitting a **different backend host/environment**.
- Conclusion: this is a **connection target mismatch**, not missing tool code.

## Fix Plan (implementation-ready)
1. **Identify exact active MCP endpoint in ChatGPT**
   - Open the MCP connector settings and copy the configured server URL/host.
   - Confirm whether it matches this project’s backend function endpoint.

2. **Apply the MCP upgrade to the currently connected server**
   - Deploy the same `mcp-server` implementation (with all 14 added tools) to the exact endpoint ChatGPT is using.
   - Ensure process restart/redeploy occurs so tool registration is rebuilt at startup.

3. **Verify function configuration on the connected server**
   - Confirm `mcp-server` exists in that server’s function list.
   - Confirm API key middleware is configured and valid for that environment.
   - Confirm no stale deployment/old version is still active.

4. **Force tool re-discovery in ChatGPT**
   - Disconnect → reconnect connector (or use Refresh tools).
   - This forces ChatGPT to reload the MCP tool registry.

5. **Acceptance test (must pass)**
   - `tools/list` must include at minimum:
     - `get_financial_summary`
     - `list_invoices`
     - `list_bills`
   - Then run:
     - `get_financial_summary`
   - Validate non-error response and expected AR/AP + overdue fields.

## Technical details
- Why this happens: MCP tools are discovered from the **currently configured endpoint at connector refresh time**. If ChatGPT is pointed at a different environment/project than where code was updated, you’ll only see that endpoint’s old tool set.
- Why redeploy/restart matters: tool definitions are registered on server boot; stale runtime instances can continue serving old registrations until restarted.
- Verification signal: seeing the new tool names in `tools/list` is the definitive proof the connector is pointed at the correct, updated server.
