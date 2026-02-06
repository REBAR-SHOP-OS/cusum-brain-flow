import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OdooRequest {
  action: string;
  model?: string;
  method?: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  domain?: unknown[];
  fields?: string[];
  limit?: number;
  offset?: number;
  id?: number;
  values?: Record<string, unknown>;
}

async function odooJsonRpc(
  url: string,
  database: string,
  username: string,
  apiKey: string,
  service: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service,
      method,
      args: params,
    },
    id: Math.floor(Math.random() * 1000000),
  };

  // Clean URL - remove trailing paths like /web/login, /web, /jsonrpc and trailing slashes
  const cleanUrl = url.replace(/\/(web(\/login)?|jsonrpc)\/?$/i, "").replace(/\/+$/, "");
  const endpoint = `${cleanUrl}/jsonrpc`;
  
  console.log(`Odoo request to: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  
  // Check if response is HTML (error page)
  if (responseText.startsWith("<!DOCTYPE") || responseText.startsWith("<html")) {
    console.error(`Odoo returned HTML instead of JSON. Status: ${response.status}`);
    console.error(`URL used: ${endpoint}`);
    console.error(`Response preview: ${responseText.substring(0, 200)}`);
    throw new Error(`Odoo URL is incorrect or not reachable. Make sure the URL points to your Odoo instance (e.g., https://yourcompany.odoo.com). Status: ${response.status}`);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    console.error(`Failed to parse Odoo response: ${responseText.substring(0, 500)}`);
    throw new Error(`Invalid response from Odoo: not valid JSON`);
  }
  
  if (result.error) {
    const errorMsg = result.error.data?.message || result.error.message || JSON.stringify(result.error);
    console.error(`Odoo API error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  return result.result;
}

async function authenticate(url: string, database: string, username: string, apiKey: string): Promise<number> {
  const uid = await odooJsonRpc(url, database, username, apiKey, "common", "authenticate", [
    database,
    username,
    apiKey,
    {},
  ]) as number;

  if (!uid) {
    throw new Error("Authentication failed - check credentials");
  }

  return uid;
}

async function executeKw(
  url: string,
  database: string,
  uid: number,
  apiKey: string,
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<unknown> {
  return await odooJsonRpc(url, database, "", apiKey, "object", "execute_kw", [
    database,
    uid,
    apiKey,
    model,
    method,
    args,
    kwargs,
  ]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ODOO_URL = Deno.env.get("ODOO_URL");
    const ODOO_DATABASE = Deno.env.get("ODOO_DATABASE");
    const ODOO_USERNAME = Deno.env.get("ODOO_USERNAME");
    const ODOO_API_KEY = Deno.env.get("ODOO_API_KEY");

    if (!ODOO_URL || !ODOO_DATABASE || !ODOO_USERNAME || !ODOO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Odoo credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: OdooRequest = await req.json();
    const { action } = body;

    // Authenticate
    const uid = await authenticate(ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_API_KEY);

    let result: unknown;

    switch (action) {
      case "check-status": {
        // Just verify connection works
        const version = await odooJsonRpc(ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_API_KEY, "common", "version", []);
        result = { status: "connected", uid, version };
        break;
      }

      case "search-read": {
        // Generic search_read for any model
        const { model, domain = [], fields = [], limit = 100, offset = 0 } = body;
        if (!model) throw new Error("Model is required");
        
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, model, "search_read", [domain], {
          fields,
          limit,
          offset,
        });
        break;
      }

      case "read": {
        // Read specific record by ID
        const { model, id, fields = [] } = body;
        if (!model || !id) throw new Error("Model and id are required");
        
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, model, "read", [[id]], {
          fields,
        });
        break;
      }

      case "create": {
        // Create new record
        const { model, values } = body;
        if (!model || !values) throw new Error("Model and values are required");
        
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, model, "create", [values]);
        break;
      }

      case "write": {
        // Update existing record
        const { model, id, values } = body;
        if (!model || !id || !values) throw new Error("Model, id, and values are required");
        
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, model, "write", [[id], values]);
        break;
      }

      case "unlink": {
        // Delete record
        const { model, id } = body;
        if (!model || !id) throw new Error("Model and id are required");
        
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, model, "unlink", [[id]]);
        break;
      }

      // CRM Specific Actions
      case "get-leads": {
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "crm.lead", "search_read", [
          body.domain || [],
        ], {
          fields: ["id", "name", "partner_id", "email_from", "phone", "expected_revenue", "probability", "stage_id", "user_id", "create_date", "date_deadline", "description"],
          limit: body.limit || 100,
          offset: body.offset || 0,
        });
        break;
      }

      case "get-lead-stages": {
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "crm.stage", "search_read", [[]], {
          fields: ["id", "name", "sequence", "fold"],
        });
        break;
      }

      case "create-lead": {
        const { values } = body;
        if (!values) throw new Error("Lead values are required");
        
        const leadId = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "crm.lead", "create", [values]);
        result = { id: leadId, success: true };
        break;
      }

      case "update-lead": {
        const { id, values } = body;
        if (!id || !values) throw new Error("Lead id and values are required");
        
        await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "crm.lead", "write", [[id], values]);
        result = { success: true };
        break;
      }

      case "move-lead-stage": {
        const { id, stage_id } = body.values || {};
        if (!id || !stage_id) throw new Error("Lead id and stage_id are required");
        
        await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "crm.lead", "write", [[id], { stage_id }]);
        result = { success: true };
        break;
      }

      case "get-contacts": {
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "res.partner", "search_read", [
          body.domain || [["is_company", "=", false]],
        ], {
          fields: ["id", "name", "email", "phone", "mobile", "company_id", "street", "city", "country_id", "create_date"],
          limit: body.limit || 100,
          offset: body.offset || 0,
        });
        break;
      }

      case "get-companies": {
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "res.partner", "search_read", [
          [["is_company", "=", true]],
        ], {
          fields: ["id", "name", "email", "phone", "website", "street", "city", "country_id", "create_date"],
          limit: body.limit || 100,
          offset: body.offset || 0,
        });
        break;
      }

      case "get-activities": {
        // Get upcoming activities/tasks
        result = await executeKw(ODOO_URL, ODOO_DATABASE, uid, ODOO_API_KEY, "mail.activity", "search_read", [
          body.domain || [],
        ], {
          fields: ["id", "res_name", "activity_type_id", "summary", "date_deadline", "state", "user_id"],
          limit: body.limit || 50,
        });
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Update integration status in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("integration_connections").upsert({
      integration_id: "odoo",
      status: "connected",
      error_message: null,
      last_checked_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
    }, { onConflict: "integration_id" });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Odoo API error:", error);
    
    // Update integration status with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from("integration_connections").upsert({
        integration_id: "odoo",
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
        last_checked_at: new Date().toISOString(),
      }, { onConflict: "integration_id" });
    } catch (e) {
      console.error("Failed to update integration status:", e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
