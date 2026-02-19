
# Fix: Add "Accounting Process" Knowledge to Penny (Accounting Agent)

## Root Cause

The Penny agent's system prompt (in `supabase/functions/ai-agent/index.ts`, around lines 878–1044) is thorough on QuickBooks data access, collection calls, and compliance deadlines — but contains **zero narrative explanation of Rebar.shop's accounting process**.

When the user asks a conceptual question like *"Can you tell me about the accounting process?"*, the model has no declarative knowledge to draw from. It cannot fabricate a company-specific process description, so it correctly (but unhelpfully) says "I don't have enough information."

## The Fix — One Change, One File

**File:** `supabase/functions/ai-agent/index.ts`  
**Location:** Inside the `accounting:` system prompt string, just before the closing backtick at line ~1044.

Insert a new section: **`## 📘 REBAR SHOP ACCOUNTING PROCESS (Company-Specific Knowledge)`**

This section will give Penny a full, factual description of the accounting workflow, organized by the cycle it belongs to. The AI will be able to answer any conceptual question about "the accounting process" by drawing on this embedded knowledge.

---

## Content to Be Added

The new knowledge section will cover:

### Revenue Cycle (Sales → Cash)
1. Customer inquiry → Quote prepared in ERP / QuickBooks Estimate
2. Quote approved → converted to Sales Order in ERP
3. Shop drawings produced → QC approved → production starts
4. Delivery completed → Packing Slip issued
5. Invoice created in QuickBooks (matching Sales Order) → emailed to customer
6. Payment received → matched against invoice in QuickBooks → AR cleared
7. Overdue invoices → escalated to Penny for collection workflow (email → call → escalate)

### Expenditure Cycle (Purchase → Payment)
1. Materials/services needed → Purchase Order (PO) created
2. PO sent to vendor → vendor delivers
3. Vendor invoice received → matched to PO in QuickBooks (3-way match: PO / receipt / bill)
4. Bill approved → scheduled for payment run
5. Payment issued (EFT / cheque) → recorded in QuickBooks → AP cleared

### Payroll Cycle
1. Timesheets collected from the ERP time-clock module
2. Hours verified by Shop Supervisor (Kourosh)
3. Payroll processed — deductions calculated (CPP, EI, income tax)
4. CRA remittance submitted by the 15th of the following month
5. T4s issued to all employees by end of February

### Month-End Close Checklist
1. Bank reconciliation (all accounts matched to QuickBooks)
2. AR aging reviewed — all invoices >30 days flagged
3. AP review — upcoming vendor payments scheduled
4. HST/GST return prepared and filed (quarterly: Jan 31, Apr 30, Jul 31, Oct 31)
5. Profit & Loss reviewed by CEO (Sattar)
6. Closed period locked in QuickBooks — no backdating

### System of Record
- QuickBooks Online is the **sole financial system of record**
- ERP (this system) serves as operational data and mirrors QB data for dashboards
- Odoo is archived and read-only — no transactions are posted there
- All financial reporting is generated from QuickBooks exports

### Key Roles
| Role | Responsibility |
|---|---|
| Vicky Anderson (Accountant) | Day-to-day bookkeeping, invoicing, collections, HST filing |
| Sattar Esmaeili (CEO) | Month-end P&L review, credit hold approval, final sign-off |
| Penny (AI) | Automated AR monitoring, collection escalation, task creation, email flagging |
| Radin Lachini (AI Manager) | ERP/system oversight, Penny configuration |

---

## Scope

| File | Lines Affected | Change Type |
|---|---|---|
| `supabase/functions/ai-agent/index.ts` | ~1037–1044 (inside `accounting:` prompt) | Insert knowledge section |

**Only one file. No database changes. No UI changes. No other agents touched.**

## What Is NOT Changed
- All other agent prompts (Vizzy, Forge, Atlas, Commander, etc.) — untouched
- The SmartTextarea grammar check — untouched
- The Deliveries packing slip — untouched
- The Pipeline lead form — untouched
- Any UI, database schema, or routing logic — untouched
