
# Complete Business Process Audit and Automation Recommendations

## Your Business at a Glance

| Domain | Volume | Current State |
|--------|--------|---------------|
| Pipeline (Leads) | 2,956 total / 1,435 active | SLA triggers exist, AI scoring active, but 1,147 leads have ZERO communications |
| Quotes | 2,588 sent ($64K avg) / 0 accepted tracked | Quote-to-order conversion is completely untracked |
| Orders | 24 created / 0 from quotes | Massive gap -- 801 won leads but orders created manually outside system |
| Accounts Receivable | $120K open / ALL 33 overdue / 17 over 90 days | Penny agent has 25 pending actions stuck at "pending_approval" |
| Production | 13 cut plans / 144 items / 134 machine runs | Working but small; 34 items queued |
| Deliveries | 4 total (all pending) | Barely used in system |
| Customers | 2,845 | Synced from Odoo, rich data |
| Contacts | 1,212 | Good coverage |
| Employees | 12 profiles / 11 tracked in timeclock | 7 salary records, 0 certifications/contracts |
| Email Marketing | 8 automations / 1 campaign | Built but barely launched |
| Support | 32 conversations | Live chat widget active |
| AI Agents | 8 agents all enabled | Vizzy, Blitz, Forge, Gauge, Penny, Pixel, Relay, Atlas |
| Estimations | 0 projects (just reset) / 380 leads with files but no estimation | Huge untapped backlog |

---

## Critical Gaps Found (Broken Loops)

### 1. Quote-to-Order Black Hole
- 2,588 quotes sent, but **0 orders** linked to any quote
- 801 leads marked "won" but only 24 orders exist in the system
- **The entire order creation process happens outside the ERP**

### 2. Collections Paralysis
- ALL $120,340.70 in AR is overdue
- 17 invoices are 90+ days past due
- 25 Penny collection actions are stuck at "pending_approval" -- nobody is approving them

### 3. Dead Pipeline Weight
- 690 leads stuck at "quotation_bids" -- the largest single stage
- 1,147 active leads have received ZERO recorded communications
- 229 leads at "quotation_priority" with no movement

### 4. Estimation Backlog
- 380 leads have uploaded files but no AI estimation has ever been run
- 21 leads sitting at estimation stages right now

### 5. HR Data Gaps
- 0 employee contracts, 0 certifications, 0 job positions defined
- Leave system works (4 requests) but no baseline data

---

## Recommended Automations (Priority-Ordered)

### TIER 1: Revenue Recovery (Implement First)

**A1. Auto-Approve Penny Collections for < $5K invoices**
Create an automation that auto-approves Penny's collection queue items when the invoice amount is under $5K and the invoice is 30+ days overdue. Only escalate large/complex ones for manual approval.
- Trigger: New `penny_collection_queue` insert
- Action: If amount < $5K and overdue > 30 days, auto-set status to "approved"
- Impact: Unblocks 25 stuck collection actions immediately

**A2. Auto-Create Orders from Won Leads**
When a lead moves to "won" stage, automatically generate an order from the linked quote, copying line items and amounts. This closes the quote-to-order gap.
- Trigger: Lead stage change to "won"
- Action: Create order from linked quote, set status "confirmed"
- Edge function: `auto-create-order-from-quote`

**A3. AR Aging Escalation Ladder**
Automated escalation based on aging:
- 30 days: Penny sends friendly reminder email
- 60 days: Penny escalates to Vizzy, creates human task for Neel
- 90 days: Auto-flag account, pause new quotes to that customer, notify accounting
- Trigger: Daily cron checks AR aging
- Edge function: `ar-aging-escalation`

### TIER 2: Pipeline Velocity

**A4. Dead Lead Recycler**
690 leads at "quotation_bids" is a graveyard. Automate:
- If no activity in 14 days at quotation stage: auto-send follow-up email via Blitz
- If no response in 30 days: move to "lost" with reason "no_response"
- If customer opens email: re-score and move back to active
- Edge function: `pipeline-lead-recycler`

**A5. Communication Gap Closer**
1,147 leads with zero communications is unacceptable. Automate:
- Daily batch: identify leads in active stages with 0 comms
- Auto-generate and send introduction/follow-up email per stage
- Log communication in `lead_communications`
- Edge function: `pipeline-comm-gap-filler`

**A6. Estimation Auto-Queue**
380 leads have files but no estimation. Automate:
- When a lead enters "estimation_ben" or "estimation_karthick" and has files in `lead_files`: auto-trigger `ai-estimate` on the shop drawings
- Store results, notify estimator for review
- Edge function: Modify `ai-estimate` to accept lead_id trigger

**A7. Quote Expiry Watchdog**
Quotes with `valid_until` approaching or passed:
- 7 days before: send renewal reminder to customer
- On expiry: notify sales rep, suggest price update
- 14 days past: auto-move lead stage to reflect stale quote
- Edge function: `quote-expiry-watchdog`

### TIER 3: Production and Operations

**A8. Auto-Generate Work Orders from Approved Shop Drawings**
When an order's `shop_drawing_status` changes to "approved" and `qc_internal_approved_at` is set:
- Auto-create work order
- Auto-generate cut plan from barlist
- Queue items to machine based on `machine_capabilities`
- Edge function: `auto-generate-work-order`

**A9. Production Completion to Delivery Auto-Schedule**
When all `cut_plan_items` for a work order reach "complete" or "clearance":
- Auto-create delivery record
- Auto-assign driver based on availability
- Send customer notification with ETA
- Edge function: `auto-schedule-delivery`

**A10. Inventory Auto-Reorder**
Monitor `floor_stock` levels:
- When stock drops below minimum threshold: auto-create purchase order draft
- Aggregate PO items by vendor for bulk ordering
- Notify purchasing team for approval
- Edge function: `inventory-auto-reorder`

### TIER 4: Intelligence and Learning

**A11. Win/Loss Pattern Analyzer**
Daily analysis of won vs. lost leads:
- Identify patterns: which sources, customers, project sizes win most
- Auto-adjust lead scoring weights based on actual outcomes
- Generate weekly insight report for sales team
- Edge function: `win-loss-analyzer`

**A12. Customer Health Score**
Automated scoring combining:
- Payment history (AR aging, payment speed)
- Quote acceptance rate
- Communication responsiveness
- Repeat business frequency
- Auto-flag "at risk" customers, suggest retention actions
- Edge function: `customer-health-score`

**A13. Smart Quote Pricing**
Before a quote is sent:
- Check historical win rates for similar project types/sizes
- Compare margin against won deals in same category
- Suggest optimal pricing based on customer's acceptance patterns
- Inject into quote engine UI
- Edge function: Modify `quote-engine`

### TIER 5: HR and Compliance

**A14. Certification Expiry Tracker**
When employee certifications are populated:
- 30 days before expiry: notify employee and HR
- On expiry: restrict assignment to certain machines/roles
- Auto-generate renewal tasks
- Edge function: `cert-expiry-tracker`

**A15. Payroll Anomaly Detector**
Daily check on timeclock data:
- Flag unusual patterns: overtime > 4 hours, missed clock-ins, weekend work without approval
- Auto-notify manager for review
- Generate weekly summary for HR
- Already partially built in `timeclock-alerts`, extend with anomaly detection

### TIER 6: Customer Experience

**A16. Project Status Auto-Updates**
For active orders/deliveries:
- Auto-send customer email updates at key milestones (shop drawing approved, production started, ready for delivery, delivered)
- Use customer portal link for self-service tracking
- Edge function: `customer-milestone-notify`

**A17. Post-Delivery Follow-Up**
After delivery is marked complete:
- Day 1: Thank you email with invoice
- Day 7: Quality satisfaction survey
- Day 30: Request for Google review
- Day 90: Re-engagement with next project inquiry
- Edge function: `post-delivery-nurture`

---

## Implementation Plan

### Phase 1 (Week 1): Revenue Recovery
- A1: Auto-approve Penny collections (new edge function + DB trigger)
- A2: Auto-create orders from won leads (new edge function + trigger on lead stage change)
- A3: AR aging escalation (new edge function + daily cron)

### Phase 2 (Week 2): Pipeline Cleanup
- A4: Dead lead recycler (new edge function + cron)
- A5: Communication gap closer (new edge function + cron)
- A7: Quote expiry watchdog (new edge function + cron)

### Phase 3 (Week 3): Production Flow
- A6: Estimation auto-queue (modify ai-estimate)
- A8: Auto-generate work orders (new edge function + trigger)
- A9: Production-to-delivery (new edge function + trigger)

### Phase 4 (Week 4): Intelligence
- A11: Win/loss analyzer (new edge function + cron)
- A12: Customer health score (new edge function + cron)
- A13: Smart quote pricing (modify quote-engine)

### Phase 5 (Ongoing): Customer Experience + HR
- A10, A14-A17: Lower urgency, implement as capacity allows

---

## Technical Architecture

Each automation follows this pattern:
1. **Trigger**: DB trigger (on insert/update) or cron schedule (via `pg_cron` or scheduled edge function calls)
2. **Edge Function**: Processes logic, queries context, executes actions
3. **Audit Trail**: All actions logged to `activity_events` with `actor_type: 'automation'`
4. **Human Override**: Critical actions (large payments, customer-facing emails) require approval via `human_tasks`
5. **Agent Integration**: Each automation maps to an AI agent (Penny for AR, Blitz for pipeline, Forge for production)

### New Edge Functions to Create
| Function | Agent | Trigger |
|----------|-------|---------|
| `auto-approve-penny` | Penny | DB trigger on `penny_collection_queue` insert |
| `auto-create-order` | Gauge | DB trigger on lead stage = 'won' |
| `ar-aging-escalation` | Penny | Daily cron |
| `pipeline-lead-recycler` | Blitz | Daily cron |
| `pipeline-comm-gap-filler` | Blitz | Daily cron |
| `quote-expiry-watchdog` | Gauge | Daily cron |
| `auto-generate-work-order` | Forge | DB trigger on order shop_drawing_status |
| `auto-schedule-delivery` | Forge | DB trigger on work order completion |
| `inventory-auto-reorder` | Forge | Daily cron |
| `win-loss-analyzer` | Atlas | Weekly cron |
| `customer-health-score` | Atlas | Daily cron |
| `customer-milestone-notify` | Relay | DB trigger on order/delivery status |
| `post-delivery-nurture` | Relay | DB trigger on delivery status = delivered |

### Database Changes
- New table: `automation_runs` (track execution history, success/failure, metrics)
- New table: `customer_health_scores` (cached health scores per customer)
- Add `lead_id` to `orders` table (link orders back to pipeline)
- Add `automation_source` column to `activity_events` (track which automation created the event)

### UI Changes
- Add "Automations Hub" page showing all 17 automations with on/off toggles, run history, and metrics
- Extend existing `AutomationsSection` on Home to include these new operational automations alongside the existing marketing ones
