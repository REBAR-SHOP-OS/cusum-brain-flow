
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getTools(agent: string, stripSendCapabilities: boolean = false) {
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "create_notifications",
        description: "Create notifications, todos, or ideas.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["notification", "todo", "idea"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string", enum: ["low", "normal", "high"] },
                  assigned_to_name: { type: "string" },
                  reminder_at: { type: "string" },
                  link_to: { type: "string" }
                },
                required: ["type", "title", "priority"]
              }
            }
          },
          required: ["items"]
        }
      }
    }
  ];

  if (!stripSendCapabilities && (agent === "accounting" || agent === "commander" || agent === "email")) {
    tools.push({
      type: "function" as const,
      function: {
        name: "send_email",
        description: "Send an email (requires approval).",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
            threadId: { type: "string" },
            replyToMessageId: { type: "string" }
          },
          required: ["to", "subject", "body"]
        }
      }
    });
  }

  // Shop Floor Tools
  if (agent === "shopfloor") {
    tools.push({
      type: "function" as const,
      function: {
        name: "update_machine_status",
        description: "Update machine status.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string", enum: ["idle", "running", "blocked", "down"] }
          },
          required: ["id", "status"]
        }
      }
    });
  }

  // Delivery Tools
  if (agent === "delivery") {
    tools.push({
      type: "function" as const,
      function: {
        name: "update_delivery_status",
        description: "Update delivery status.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" }
          },
          required: ["id", "status"]
        }
      }
    });
  }

  // Empire / Architect Tools
  if (agent === "empire") {
    tools.push(
      {
        type: "function" as const,
        function: {
          name: "db_read_query",
          description: "Run SELECT query.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "db_write_fix",
          description: "Run UPDATE/INSERT query.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" }, reason: { type: "string" }, confirm: { type: "boolean" } },
            required: ["query", "reason", "confirm"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "resolve_task",
          description: "Resolve an autofix task.",
          parameters: {
            type: "object",
            properties: { task_id: { type: "string" }, resolution_note: { type: "string" }, new_status: { type: "string" } },
            required: ["task_id", "resolution_note"]
          }
        }
      }
    );
  }

  return tools;
}
