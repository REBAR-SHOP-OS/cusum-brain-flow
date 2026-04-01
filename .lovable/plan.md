

# Sales & CRM Standalone Module — Architecture Package

## Objective
Generate a comprehensive 20-file standalone architecture package for the Sales & CRM module, extracted from the Rebar Shop OS ERP. Output as a single downloadable PDF containing all 20 specification files.

## Data Gathered from Codebase

### Database Tables (28 tables total)
**Dual Pipeline System:**
1. **Legacy/Odoo Pipeline:** `leads`, `lead_activities`, `lead_assignees`, `lead_communications`, `lead_events`, `lead_score_history`, `lead_scoring_rules`, `lead_qualification_memory`, `lead_quote_memory`, `lead_loss_memory`, `lead_outcome_memory`, `pipeline_ai_actions`, `pipeline_automation_rules`
2. **New Sales Department:** `sales_leads`, `sales_lead_activities`, `sales_lead_assignees`, `sales_contacts`, `sales_quotations`, `sales_quotation_items`, `sales_invoices`, `sales_invoice_items`, `quote_audit_log`, `quote_pricing_configs`
3. **Shared:** `customers`, `contacts`, `communications`, `companies`, `profiles`, `user_roles`, `prospect_batches`, `prospects`

### Frontend Routes (9 routes)
- `/pipeline` — Legacy Odoo-synced Kanban board (1041-line page)
- `/lead-scoring` — Scoring engine
- `/pipeline/intelligence` — Analytics/forecasting
- `/prospecting` — AI-powered prospect discovery
- `/customers` — Customer master list
- `/sales` — Sales Hub (new department)
- `/sales/pipeline` — Internal pipeline
- `/sales/quotations` — Quotation management
- `/sales/invoices` — Invoice management
- `/sales/contacts` — Contact management

### Components (50+ components)
- `src/components/pipeline/` — 32 files (Board, Cards, Drawers, AI, Filters, Gates, Intelligence)
- `src/components/sales/` — 10 files (Lead drawer, Smart buttons, Chatter, Quotation/Invoice drawers)
- `src/components/crm/` — 1 file (Lead Scoring Engine)
- `src/components/prospecting/` — Multiple files

### Hooks (25+ hooks)
- `useSalesLeads`, `useSalesContacts`, `useSalesQuotations`, `useSalesInvoices`, `useSalesLeadActivities`
- `useLeadScoring`, `useLeadAssignees`, `useLeadRecommendation`
- `usePipelineAI`, `usePipelineBulkActions`, `usePipelineMemory`, `usePipelineRealtime`, `usePipelineStageOrder`
- `usePipelineKeyboardShortcuts`, `useCommunications`, `useScheduledActivities`

### Edge Functions (20+ relevant)
- `odoo-crm-sync`, `pipeline-ai`, `pipeline-automation-engine`, `pipeline-digest`, `pipeline-lead-recycler`, `pipeline-webhooks`
- `process-rfq-emails`, `prospect-leads`, `notify-lead-assignees`
- `quote-engine`, `quote-expiry-watchdog`, `quote-public-view`, `send-quote-email`, `convert-quote-to-order`
- `import-crm-data`, `relay-pipeline`, `check-sla-breaches`, `comms-alerts`
- `ai-estimate`, `ai-generate-quotation`

### Business Logic Highlights
- **29-stage Kanban** mirroring Odoo with stage groups (Sales, Estimation, Quotation, Operations, Terminal)
- **Transition gates:** Qualification, Pricing, Loss, Delivery, Next Activity, Handoff gates
- **Quotation state machine:** 13 statuses with strict `QUOTE_ALLOWED_TRANSITIONS` map
- **Lead scoring:** Rule-based engine with field/operator/value/points
- **AI Autopilot:** Scans pipeline, suggests actions, approve/dismiss workflow
- **Smart search:** Parses tokens like `stage:won priority:high` from search bar
- **Contact deduplication:** Merges manual, system (contacts), and customer sources

## Approach
1. Write a Python script using `reportlab` to generate a structured PDF
2. Include all 20 files with full technical content derived from real codebase analysis
3. QA the output visually
4. Deliver as downloadable artifact

## Output
`/mnt/documents/Sales-CRM-Standalone-Architecture.pdf`

