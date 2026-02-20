
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function executeToolCall(
  toolCall: any, 
  agent: string, 
  user: any, 
  companyId: string, 
  svcClient: ReturnType<typeof createClient>, 
  context: any,
  authHeader: string
) {
  const result: any = { tool_call_id: toolCall.id, result: {}, sideEffects: {} };
  const name = toolCall.function.name;
  let args = {};
  
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    return { ...result, result: { error: "Invalid JSON arguments" } };
  }

  try {
    // 1. Notifications
    if (name === "create_notifications") {
      const items = args.items || [];
      const notifications = [];
      
      for (const item of items) {
        // Simple resolution of assignee from context
        let assignedTo = null;
        if (item.assigned_to_name && context.availableEmployees) {
          const match = context.availableEmployees.find((e: any) => e.name.toLowerCase().includes(item.assigned_to_name.toLowerCase()));
          if (match) assignedTo = match.id;
        }

        const { error } = await svcClient.from("notifications").insert({
          user_id: user.id,
          type: item.type || "todo",
          title: item.title,
          description: item.description,
          priority: item.priority || "normal",
          assigned_to: assignedTo,
          status: "unread",
          agent_name: agent,
          metadata: { created_by_agent: agent }
        });

        if (!error) notifications.push(item);
      }
      result.result = { success: true, count: notifications.length };
      result.sideEffects.notifications = notifications;
    }

    // 2. Send Email
    else if (name === "send_email") {
      const emailRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": authHeader },
          body: JSON.stringify(args)
        }
      );
      if (emailRes.ok) {
        result.result = { success: true, to: args.to };
        result.sideEffects.emails = [{ to: args.to }];
      } else {
        result.result = { success: false, error: await emailRes.text() };
      }
    }

    // 3. DB Read (Empire)
    else if (name === "db_read_query") {
      const { data, error } = await svcClient.rpc("execute_readonly_query", { sql_query: args.query });
      result.result = error ? { error: error.message } : { success: true, rows: data };
    }

    // 4. DB Write (Empire)
    else if (name === "db_write_fix") {
      const { error } = await svcClient.rpc("execute_write_fix", { sql_query: args.query });
      result.result = error ? { error: error.message } : { success: true, message: "Query executed" };
    }

    // 5. Update Statuses
    else if (name === "update_machine_status") {
      const { data, error } = await svcClient.from("machines").update({ status: args.status }).eq("id", args.id).select();
      result.result = error ? { error: error.message } : { success: true, data };
    }
    
    // Default fallback
    else {
      result.result = { success: true, message: "Tool executed (simulated)" };
    }

  } catch (err) {
    result.result = { error: err instanceof Error ? err.message : String(err) };
  }

  return result;
}
