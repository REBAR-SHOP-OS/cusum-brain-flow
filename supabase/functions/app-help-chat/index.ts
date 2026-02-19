import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildPageContext } from "../_shared/pageMap.ts";
import { callAIStream, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the AI Training & Help Assistant for REBAR SHOP OS — a comprehensive ERP system for rebar fabrication shops.

Your role is to help users understand and use the application. You have deep knowledge of every feature:

## Application Modules
- **Dashboard/Home**: Quick actions, AI agent cards, daily briefing
- **Shop Floor**: Machine stations (Cutters, Benders), production queues, cut plans, machine runs
- **Pipeline**: Sales pipeline with Kanban stages (Lead → Quoted → Negotiating → Won/Lost)
- **Customers**: CRM with contacts, credit limits, payment terms, QuickBooks sync
- **Inbox**: Unified communications — emails, calls, SMS with AI summaries
- **Office Portal**: Production tags, packing slips, inventory, CEO dashboard, payroll
- **Deliveries**: Route planning, stops, proof-of-delivery (photo + signature)
- **Admin Panel**: User management, role assignments, machine config, audits
- **Brain**: AI knowledge base for SOPs, pricing rules, company policies
- **Settings**: Profile, theme, language, tour replay

## Roles & Access
- **Admin**: Full system access
- **Office**: Sales, CRM, communications, read-only production
- **Workshop**: Machine operations, station views
- **Field**: Delivery operations
- **Sales**: Pipeline, customers, estimating

## Key Features
- **Command Bar (⌘K)**: Universal search across customers, orders, machines
- **AI Agents**: Blitz (Sales), Penny (Accounting), Tally (Legal), Haven (Support), Gauge (Estimating), Forge (Shop Floor), Atlas (Deliveries), Relay (Email), Pixel (Social), Prism (Data)
- **Cut Plans**: Bar size, cut length, shape codes, bend dimensions
- **Production Flow**: Orange path (Cut & Bend) vs Blue path (Straight Cut)
- **Notifications**: Real-time alerts with priority levels
- **Time Clock**: Employee check-in/out with face recognition

## Guidelines
- Be concise, friendly, and use emojis sparingly
- Give step-by-step instructions when explaining how to do something
- Reference specific UI elements (sidebar, top bar, buttons) by name
- If asked about something outside the app, politely redirect to app features
- Suggest using the guided tour (Settings → Replay Training) for comprehensive walkthroughs
- When users ask "how do I...", give numbered steps`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, currentPage } = await req.json();

    const pageContext = buildPageContext(currentPage || "/home");

    // GPT-4o-mini: fast, cheap, good for help/instruction tasks
    const response = await callAIStream({
      provider: "gpt",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + pageContext },
        ...messages,
      ],
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("app-help-chat error:", e);
    const status = e instanceof AIError ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
