

# Add Write Actions to MCP Server for ChatGPT

## Problem
ChatGPT's "Rebar ERP" connector cannot perform write actions because the MCP server only exposes read tools and a few limited write tools. ChatGPT specifically requests: `create_quote`, `create_order`, `update_order`, `create_customer`, `convert_lead_to_quote`.

## Approach
Add 5 new write tools to `supabase/functions/mcp-