
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

  // Estimation Tools
  if (agent === "estimation") {
    tools.push(
      {
        type: "function" as const,
        function: {
          name: "run_takeoff",
          description: "Run an AI-powered rebar takeoff from uploaded structural drawings. Returns project ID and full BOM summary.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Project name (e.g. '20 York St - Foundation')" },
              file_urls: { type: "array", items: { type: "string" }, description: "URLs of uploaded PDF/image files" },
              customer_id: { type: "string" },
              lead_id: { type: "string" },
              waste_factor_pct: { type: "number", description: "Waste percentage (default 5)" },
              scope_context: { type: "string", description: "Additional context about what to estimate" }
            },
            required: ["name", "file_urls"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "get_estimate_summary",
          description: "Fetch an estimation project's summary and item breakdown.",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "update_estimate_item",
          description: "Manually correct/override an AI-extracted estimation item.",
          parameters: {
            type: "object",
            properties: {
              item_id: { type: "string" },
              quantity: { type: "number" },
              cut_length_mm: { type: "number" },
              bar_size: { type: "string" },
              mark: { type: "string" },
              element_ref: { type: "string" }
            },
            required: ["item_id"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "apply_waste_factor",
          description: "Recalculate an estimation project with a different waste percentage.",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string" },
              waste_factor_pct: { type: "number" }
            },
            required: ["project_id", "waste_factor_pct"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "convert_to_quote",
          description: "Create a quote/order record from an estimation project.",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string" },
              customer_id: { type: "string" },
              notes: { type: "string" }
            },
            required: ["project_id"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "export_estimate",
          description: "Generate a structured JSON export of the estimation project for download.",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string" }
            },
            required: ["project_id"]
          }
        }
      }
    );
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

  // Accounting (Penny) — QB Action Tools
  if (agent === "accounting" || agent === "collections") {
    tools.push(
      {
        type: "function" as const,
        function: {
          name: "fetch_qb_report",
          description: "Fetch a live financial report from QuickBooks: ProfitAndLoss, BalanceSheet, AgedReceivables, AgedPayables, CashFlow, or TaxSummary. Use when the user asks for P&L, balance sheet, AR aging, AP aging, cash flow, or HST/GST summary.",
          parameters: {
            type: "object",
            properties: {
              report_type: {
                type: "string",
                enum: ["ProfitAndLoss", "BalanceSheet", "AgedReceivables", "AgedPayables", "CashFlow", "TaxSummary"],
                description: "Type of report to fetch from QuickBooks"
              },
              start_date: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
              end_date: { type: "string", description: "End date YYYY-MM-DD (optional)" },
              period: { type: "string", description: "e.g. 'This Month', 'Last Month', 'This Year', 'Last Year'" }
            },
            required: ["report_type"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "fetch_gl_anomalies",
          description: "Scan the general ledger for anomalies: round-number entries, unbalanced lines, unusual accounts, or large transactions. Use for audit and financial review.",
          parameters: {
            type: "object",
            properties: {
              days_back: { type: "number", description: "How many days back to scan (default 30)" },
              min_amount: { type: "number", description: "Minimum transaction amount to flag (default 1000)" }
            },
            required: []
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "trigger_qb_sync",
          description: "Trigger an incremental QuickBooks sync to pull the latest invoices, payments, and bills. Use when the user says data looks stale or asks to refresh QB data.",
          parameters: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["incremental", "full"], description: "Sync mode (default: incremental)" }
            },
            required: []
          }
        }
      }
    );
  }

  // Quote engine tool — available to estimation and sales agents
  if (agent === "estimation" || agent === "sales" || agent === "commander") {
    tools.push({
      type: "function" as const,
      function: {
        name: "generate_sales_quote",
        description: "Generate a deterministic rebar sales quote using the quote engine. Pass a structured estimate_request JSON with scope (straight bars, fabricated bars, cages, dowels, ties, shipping). Returns line items, spreadsheet table, weights, and pricing breakdown.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["validate", "quote", "explain"],
              description: "validate = check inputs, quote = generate full quote, explain = plain-English explanation"
            },
            estimate_request: {
              type: "object",
              description: "Full estimate_request JSON matching the quote engine template"
            }
          },
          required: ["action", "estimate_request"]
        }
      }
    });
  }

  return tools;
}
