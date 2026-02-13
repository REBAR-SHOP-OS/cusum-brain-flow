

# Audit All Agents — Full System Review

## Summary of Findings

After reviewing the entire agent infrastructure (3,760-line edge function, 18 agent configs, model routing, context fetching, and governance rules), here is a comprehensive audit.

---

## Agent Registry (18 agents configured in frontend)

| # | Key | Name | Agent Type | Model Routing | Has Dedicated Context | Issues Found |
|---|-----|------|-----------|---------------|----------------------|--------------|
| 1 | sales | Blitz | sales | Flash-Lite / Flash-preview | Yes (leads, pipeline) | None |
| 2 | support | Haven | support | Flash-Lite / Flash-preview | Yes (tasks, deliveries, machines) | None |
| 3 | accounting | Penny | accounting | Flash-Lite / Flash | Yes (QB live, emails, AR, tasks) | None |
| 4 | legal | Tally | legal | Default (Flash-preview) | No dedicated fetch | **Issue 1** |
| 5 | estimating | Gauge | estimation | Flash / Pro | Yes (leads, files, emails, rebar standards) | None |
| 6 | shopfloor | Forge | support | Same as Haven | Shares support context | **Issue 2** |
| 7 | delivery | Atlas | support | Same as Haven | Shares support context | **Issue 3** |
| 8 | email | Relay | support | Same as Haven | Shares support context | **Issue 4** |
| 9 | social | Pixel | social | Flash / Flash-preview | Yes (social posts, image gen) | None |
| 10 | eisenhower | Eisenhower | eisenhower | Default (Flash-preview) | No dedicated fetch | **Issue 5** |
| 11 | data | Prism | support | Same as Haven | Shares support context | **Issue 6** |
| 12 | bizdev | Buddy | bizdev | Flash-preview | No dedicated fetch | **Issue 7** |
| 13 | webbuilder | Commet | webbuilder | Flash-preview | No dedicated fetch | **Issue 8** |
| 14 | assistant | Vizzy | assistant | Pro | Yes (full cross-department) | None |
| 15 | copywriting | Penn | copywriting | Flash-preview | No dedicated fetch | **Issue 9** |
| 16 | talent | Scouty | talent | Flash | No dedicated fetch | **Issue 10** |
| 17 | seo | Seomi | seo | Flash-preview | No dedicated fetch | **Issue 11** |
| 18 | growth | Gigi | growth | Default (Flash-preview) | No dedicated fetch | **Issue 12** |

---

## Issues Found

### Critical Issues

**Issue 2, 3, 4, 6 — Forge, Atlas, Relay, Prism all route to `agentType: "support"`**
These 4 agents share Haven's agent type, meaning they all get Haven's system prompt and context. They have distinct frontend identities (Shop Floor, Delivery, Email, Data) but the backend treats them all as generic "support." They are essentially Haven wearing different hats.
- **Impact**: Users talking to Forge about machine maintenance get Haven's customer support prompt. Atlas gets no delivery-specific intelligence. Relay has no email-focused logic. Prism has no analytics capability.
- **Fix**: Give each a unique agent type and dedicated system prompt + context fetch.

**Issue 1 — Tally (Legal) has no dedicated context fetch**
The `fetchContext` function has no `if (agent === "legal")` branch. Tally only gets the base context (15 recent emails + 15 customers). No contracts, no lien deadlines, no compliance data.
- **Fix**: Add a legal context fetch (orders with lien deadlines, contracts, compliance dates).

### Moderate Issues

**Issue 5 — Eisenhower has no dedicated context**
No `fetchContext` branch for "eisenhower". It only gets the shared base context. No task data, no priority history.
- **Fix**: Fetch user's tasks, priorities, and recent Eisenhower sessions.

**Issues 7-12 — Bizdev, Webbuilder, Copywriting, Talent, SEO, Growth have no context**
These 6 agents have system prompts but zero dedicated data fetching. They operate on just the base 15 emails + 15 customers. They are effectively "prompt-only" agents with no real data access.
- **Fix**: Add relevant context fetches (e.g., Bizdev gets leads + competitors, Talent gets employee data, etc.).

### Minor/Cosmetic Issues

**Accounting image mismatch**: Penny uses `socialHelper` image (line 54). Should use `accountingHelper`.

**Social image mismatch**: Pixel uses `accountingHelper` image (line 108). Should use `socialHelper`.

**Legal image placeholder**: Tally uses `accountingHelper` with a TODO comment (line 63).

---

## Model Routing Summary

| Agent | Simple Query | Complex Query | Notes |
|-------|-------------|--------------|-------|
| Vizzy (assistant) | Pro | Pro | Always Pro for reliable instruction following |
| Gauge (estimation) | Flash | Pro | Pro for deep analysis, Flash for quick Q&A |
| Penny (accounting) | Flash-Lite | Flash | Flash for complex financial + call requests |
| Blitz (sales) | Flash-Lite | Flash-preview | Flash-preview for pipeline analysis |
| Haven (support) | Flash-Lite | Flash-preview | Flash-preview for escalations |
| Pixel (social) | Flash | Flash-preview | High temperature for creativity |
| Penn (copywriting) | Flash-preview | Flash-preview | Always Flash-preview |
| Seomi (seo) | Flash-preview | Flash-preview | Always Flash-preview |
| Buddy (bizdev) | Flash-preview | Flash-preview | Always Flash-preview |
| Scouty (talent) | Flash | Flash | Always Flash |
| Commet (webbuilder) | Flash-preview | Flash-preview | Always Flash-preview |
| Gigi (growth) | Flash-preview | Flash-preview | Default fallback |
| Tally (legal) | Flash-preview | Flash-preview | Default fallback (no dedicated routing) |
| Eisenhower | Flash-preview | Flash-preview | Default fallback (no dedicated routing) |

**Issue 13 — Legal has no dedicated model routing**: Falls through to default. Legal analysis (contracts, compliance) would benefit from Pro or at least Flash for precision.

---

## Governance & Security (All Good)

- Role-based access control: Properly enforced per user role (admin/accounting/office/sales/workshop/field)
- No-cross-interference policy: Injected into all agent prompts
- Draft-only mode: Correctly blocks external actions when `comms_agent_pairing.draft_only` or `comms_config.no_act_global` is set
- Rate limiting: 10 requests/60 seconds per user -- working correctly
- Auth: JWT validation on every request -- correct

---

## Recommended Fix Plan

### Phase 1 — Image Fixes (cosmetic, quick win)
1. Swap Penny's image from `socialHelper` to `accountingHelper`
2. Swap Pixel's image from `accountingHelper` to `socialHelper`
3. Add a dedicated legal helper image or use a distinct existing one for Tally

### Phase 2 — Give Forge, Atlas, Relay, Prism unique agent types
1. Add new agent types: `"shopfloor"`, `"delivery"`, `"email"`, `"data"` to the `AgentType` union
2. Update `agentConfigs.ts` to use these new types
3. Add dedicated system prompts in `agentPrompts` for each
4. Add dedicated `fetchContext` branches for each
5. Add model routing for each in `selectModel`

### Phase 3 — Add context fetches for prompt-only agents
Add `fetchContext` branches for: legal, eisenhower, bizdev, webbuilder, copywriting, talent, seo, growth — pulling relevant data from existing tables.

### Phase 4 — Add model routing for legal + eisenhower
Give Tally a dedicated `selectModel` case (Flash for simple, Pro for contract analysis). Give Eisenhower a case optimized for prioritization tasks.

