
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

  // Social / Pixel — Image & Video Generation
  if (agent === "social") {
    tools.push(
      {
        type: "function" as const,
        function: {
          name: "generate_image",
          description: "Generate a promotional image for social media. The image will be created with English text overlay and the REBAR.SHOP logo. Returns a public URL of the generated image.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Detailed description of the image to generate (scene, product, mood, text overlay). MUST explicitly describe the mandatory style and products in the prompt text itself." },
              slot: { type: "string", description: "Time slot identifier (e.g. '06:30', '07:30', '08:00', '12:30', '14:30')" },
              style: { type: "string", description: "The visual style the user selected (e.g. cartoon, realism, painting, animation, cinematic, dark, golden, minimal, urban, ai_modern). MUST match user's selection exactly." },
              products: { type: "string", description: "The products the user selected to feature (e.g. stirrups, cages, hooks, dowels, wire_mesh, rebar_straight, fiberglass_straight). MUST match user's selection." },
              aspect_ratio: { type: "string", description: "Image aspect ratio: '16:9' (landscape), '1:1' (square), or '9:16' (portrait/story). MUST match user's size selection from toolbar." }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "generate_video",
          description: "Generate a short promotional video for social media using AI (Veo 3). Returns a public URL of the generated video. Use when user asks for a video, story, reel, or motion content.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Detailed description of the video (scene, product, action, mood, camera movement)" },
              duration: { type: "number", description: "Duration in seconds (5-15, default 8)" },
              slot: { type: "string", description: "Time slot identifier" }
            },
            required: ["prompt"]
          }
        }
      }
    );
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
      },
      {
        type: "function" as const,
        function: {
          name: "read_task",
          description: "Read an autopilot run / autofix task by ID.",
          parameters: {
            type: "object",
            properties: { task_id: { type: "string", description: "UUID of the autopilot run" } },
            required: ["task_id"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "generate_patch",
          description: "Create a code patch entry for review.",
          parameters: {
            type: "object",
            properties: {
              file_path: { type: "string", description: "Target file path" },
              patch_content: { type: "string", description: "Unified diff or replacement code" },
              description: { type: "string", description: "What the patch does" },
              patch_type: { type: "string", description: "Type: fix, feature, refactor" },
              target_system: { type: "string", description: "e.g. lovable, odoo, wordpress" }
            },
            required: ["file_path", "patch_content", "description"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "validate_code",
          description: "Validate a code patch for dangerous patterns before applying.",
          parameters: {
            type: "object",
            properties: { patch_content: { type: "string", description: "Code to validate" } },
            required: ["patch_content"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "create_fix_ticket",
          description: "Create a fix ticket to track a bug or issue.",
          parameters: {
            type: "object",
            properties: {
              system_area: { type: "string", description: "Affected system area" },
              repro_steps: { type: "string", description: "Steps to reproduce" },
              expected_result: { type: "string", description: "What should happen" },
              actual_result: { type: "string", description: "What actually happens" },
              severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
              page_url: { type: "string", description: "URL of affected page" },
              screenshot_url: { type: "string", description: "Screenshot evidence URL" }
            },
            required: ["system_area", "repro_steps", "severity"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "update_fix_ticket",
          description: "Update the status or details of a fix ticket.",
          parameters: {
            type: "object",
            properties: {
              ticket_id: { type: "string" },
              status: { type: "string", enum: ["open", "diagnosed", "fixing", "fixed", "verified", "closed"] },
              fix_output: { type: "string", description: "Description of fix applied" },
              fix_output_type: { type: "string", description: "e.g. patch, config, migration" }
            },
            required: ["ticket_id", "status"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "list_fix_tickets",
          description: "List open fix tickets for the company.",
          parameters: {
            type: "object",
            properties: {
              status_filter: { type: "string", description: "Filter by status (default: open)" },
              limit: { type: "number", description: "Max results (default 20)" }
            },
            required: []
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
