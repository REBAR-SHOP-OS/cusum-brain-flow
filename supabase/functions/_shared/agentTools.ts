
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

  if (!stripSendCapabilities && (agent === "accounting" || agent === "commander" || agent === "email" || agent === "sales")) {
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
              products: { type: "string", description: "The products the user selected to feature (e.g. stirrups, cages, hooks, dowels, wire_mesh, rebar_straight, fiberglass_straight). MUST match user's selection." }
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
    tools.push(
      {
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
      },
      {
        type: "function" as const,
        function: {
          name: "get_production_report",
          description: "Fetch today's production report: machine runs, pieces produced, operator activity, scrap. Use for daily summaries and 'what happened today' questions.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "get_work_orders",
          description: "List work orders with date awareness. Supports 3 modes: 'active' (default — currently queued/pending/in-progress), 'created_today' (only WOs created today), 'scheduled_today' (only WOs scheduled for today). Each result includes is_created_today and is_scheduled_today flags. When user asks 'today's work orders', use mode='created_today' or 'scheduled_today'. When user asks 'are these from today', check the is_created_today flag.",
          parameters: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["active", "created_today", "scheduled_today"], description: "Query mode: 'active' (default), 'created_today', or 'scheduled_today'" },
              status_filter: { type: "string", description: "Filter by status (only used in 'active' mode): queued, pending, in-progress, completed" },
              limit: { type: "number", description: "Max results (default 30)" }
            },
            required: []
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "get_cut_plan_status",
          description: "Show cut plan progress: items by phase (queued, cutting, bending, complete, clearance). Use for production tracking.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "get_timeclock_summary",
          description: "Show who is clocked in today, shift hours, breaks. Use for staffing and attendance questions.",
          parameters: { type: "object", properties: {}, required: [] }
        }
      }
    );
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

    // WordPress / rebar.shop tools for empire agent
    tools.push(
      {
        type: "function" as const,
        function: {
          name: "wp_list_posts",
          description: "List WordPress posts from rebar.shop.",
          parameters: { type: "object", properties: { per_page: { type: "string" }, status: { type: "string" } }, required: [] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "wp_list_pages",
          description: "List WordPress pages from rebar.shop.",
          parameters: { type: "object", properties: { per_page: { type: "string" } }, required: [] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "wp_list_products",
          description: "List WooCommerce products from rebar.shop.",
          parameters: { type: "object", properties: { per_page: { type: "string" }, status: { type: "string" } }, required: [] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "wp_list_orders",
          description: "List WooCommerce orders from rebar.shop.",
          parameters: { type: "object", properties: { per_page: { type: "string" }, status: { type: "string" } }, required: [] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "wp_update_post",
          description: "Update a WordPress post by ID.",
          parameters: { type: "object", properties: { id: { type: "string" }, data: { type: "object" } }, required: ["id", "data"] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "wp_update_page",
          description: "Update a WordPress page by ID.",
          parameters: { type: "object", properties: { id: { type: "string" }, data: { type: "object" } }, required: ["id", "data"] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "wp_update_product",
          description: "Update a WooCommerce product by ID.",
          parameters: { type: "object", properties: { id: { type: "string" }, data: { type: "object" } }, required: ["id", "data"] }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "scrape_page",
          description: "Fetch any URL and return the text/HTML content. Use for live website diagnostics.",
          parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
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

  // Save sales quotation — available to sales and commander
  if (agent === "sales" || agent === "commander") {
    tools.push(
      {
        type: "function" as const,
        function: {
          name: "save_sales_quotation",
          description: "Save an approved quotation to the Sales Quotations system. Returns the quotation ID and number.",
          parameters: {
            type: "object",
            properties: {
              customer_name: { type: "string", description: "Customer contact name" },
              customer_company: { type: "string", description: "Customer company name" },
              amount: { type: "number", description: "Total quotation amount in CAD" },
              notes: { type: "string", description: "Quotation details and line items summary" },
              expiry_date: { type: "string", description: "Quotation expiry date YYYY-MM-DD (default: 30 days from now)" },
              lead_id: { type: "string", description: "Optional linked lead ID" },
              line_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    quantity: { type: "number" },
                    unit: { type: "string" },
                    unit_price: { type: "number" },
                    total: { type: "number" }
                  }
                },
                description: "Detailed line items from the quote"
              }
            },
            required: ["amount", "notes"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "send_quotation_email",
          description: "Send a professional branded quotation email to a customer. Generates a beautiful HTML email with REBAR.SHOP branding, line items table, totals, validity period, and professional signature.",
          parameters: {
            type: "object",
            properties: {
              quotation_id: { type: "string", description: "UUID of the saved quotation" },
              to_email: { type: "string", description: "Customer email address" },
              customer_name: { type: "string", description: "Customer name for greeting" },
              subject: { type: "string", description: "Email subject (optional — auto-generated if not provided)" }
            },
            required: ["quotation_id", "to_email", "customer_name"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "convert_quotation_to_invoice",
          description: "Convert an approved quotation to a sales invoice, generate a Stripe payment link, and send a professional invoice email with a Pay Now button. Use when the customer has accepted the quote.",
          parameters: {
            type: "object",
            properties: {
              quotation_id: { type: "string", description: "UUID of the approved quotation to convert" },
              customer_email: { type: "string", description: "Customer email to send the invoice to" },
              due_date: { type: "string", description: "Invoice due date YYYY-MM-DD (default: 30 days from now)" }
            },
            required: ["quotation_id", "customer_email"]
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

  // Purchasing agent tools
  if (agent === "purchasing") {
    tools.push(
      {
        type: "function" as const,
        function: {
          name: "purchasing_add_item",
          description: "Add an item to the purchasing list.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Item name" },
              quantity: { type: "number", description: "Quantity needed (default 1)" },
              category: { type: "string", description: "Category: مصالح, ابزار, لوازم اداری, ایمنی, متفرقه" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              due_date: { type: "string", description: "Target date YYYY-MM-DD" },
            },
            required: ["title"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "purchasing_list_items",
          description: "List purchasing items. Optionally filter by status or date.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["all", "pending", "purchased"] },
              due_date: { type: "string", description: "Filter by date YYYY-MM-DD" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "purchasing_toggle_item",
          description: "Toggle an item's purchased status.",
          parameters: {
            type: "object",
            properties: {
              item_id: { type: "string", description: "UUID of the item" },
              is_purchased: { type: "boolean", description: "New purchased status" },
            },
            required: ["item_id", "is_purchased"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "purchasing_delete_item",
          description: "Delete an item from the purchasing list.",
          parameters: {
            type: "object",
            properties: {
              item_id: { type: "string", description: "UUID of the item" },
            },
            required: ["item_id"],
          },
        },
      }
    );
  }

  return tools;
}
