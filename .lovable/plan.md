

# Agent-to-Menu Mapping PDF Report

## What This Delivers
A comprehensive PDF document listing:
1. All 22 agents with their current names, roles, and which menu/page they serve
2. Agent-to-user assignments (who uses which agent)
3. Renamed agents table (old name vs new name)

## Data Gathered

### Agents (22 total)
| Agent Code | Name | Role | Connected Menu/Page |
|---|---|---|---|
| sales | Blitz | Sales & Pipeline | Pipeline, Lead Scoring, Sales |
| support | Haven | Customer Support | Support |
| accounting | Penny | Accounting (50yr CPA) | Accounting |
| legal | Tally | Legal (55yr Ontario Lawyer) | — (chat only) |
| estimating | Gauge | Estimating | — (chat only) |
| shopfloor | Forge | Shop Floor Commander | Shop Floor |
| delivery | Atlas | Deliveries | Delivery Ops (sub-page) |
| email | Relay | Email & Inbox | Inbox |
| social | Pixel | Social Media | Social Media Manager |
| eisenhower | Eisenhower Matrix | Priority Matrix | Business Tasks |
| data | Prism | Data & Insights | Live Monitor, CEO Portal |
| rebuild | Rebuild | System Rebuild | — (internal/dev) |
| bizdev | Buddy | Business Development | — (chat only) |
| webbuilder | Commet | Web Builder | Website/SEO pages |
| assistant | Vizzy | CEO Assistant | Dashboard, CEO Portal |
| copywriting | Penn | Copywriting | — (chat only) |
| talent | Scouty | Talent & HR | — (chat only) |
| seo | Seomi | SEO & Search | SEO |
| growth | Gigi | Personal Development | — (chat only) |
| empire | Architect | Venture Builder | — (chat only) |
| purchasing | Kala | Purchasing & Procurement | — (chat only) |
| azin | Nila | Real-Time Interpreter | — (voice only) |

### Renamed Agents (from AgentSelector and legacy references)
| Old Name / Code | New Name | Change |
|---|---|---|
| collections / Chase | Merged into Penny (Accounting) | AR & Payments folded into accounting agent |
| commander | Removed from active roster | Was "Sales Manager", functionality in Vizzy |
| estimation → estimating | Gauge | Code normalized |

### User-Agent Assignments
From `userAgentMap.ts` — 8 mapped users.

## Technical Plan
1. Run a Python script using `reportlab` to generate a styled PDF at `/mnt/documents/`
2. Include Rebar Shop OS branding (dark header, structured tables)
3. Three sections: Agent Registry, Menu Mapping, Renamed Agents
4. QA via `pdftoppm` visual inspection

## Files Changed
None — this is a data artifact generation task only.
