

# Redesign Landing Page: The Industrial Brain for Rebar Factories

## Overview
Complete rewrite of `src/pages/Landing.tsx` to reflect the new positioning as an industrial AI production intelligence platform. Keep existing sub-components (footer, chat widget) but replace all hero, features, stats, and CTA content.

## Changes

### `src/pages/Landing.tsx` — Full content rewrite

**Hero Section**
- Badge: "Industrial AI for Rebar Manufacturing"
- H1: "The Industrial Brain for Rebar Factories"
- Subtitle: "AI-powered production intelligence that eliminates waste, prevents errors, and turns workshops into data-driven smart factories."
- Stats updated to: 30% waste reduction, Near-zero deviation, 4 core modules, Odoo-ready

**Problem Section** (new)
- "The Hidden Cost of Manual Production" — grid of 6 pain points (10-25% waste, counting errors, no Waste Bank, poor inventory, ignored leftovers, no real-time intelligence)

**4 Core Modules** (replaces old 6-feature grid)
1. AI Waste Optimization Engine — system-level optimization prioritizing Waste Bank
2. Loop Control System — sensor + AI hybrid for cutter/bender count control
3. Digital Waste Bank — classified, tagged, searchable leftover inventory
4. Production Intelligence Dashboard — real-time KPIs and analytics

**How It Works** — 3 phases: Deploy (hardware + software setup) → Optimize (AI learns your production) → Scale (multi-site expansion)

**Competitive Positioning Section** (new)
- Visual comparison: Machine manufacturers = hardware, ERP vendors = accounting, Optimization software = cut-plans, LOVABLE = full production intelligence

**Revenue/Pricing Tiers** (new)
- Tier 1: Optimization Only
- Tier 2: Optimization + Waste Bank  
- Tier 3: Full AI Production Control

**Hardware + Software Architecture** (new visual section)
- Edge layer (sensors, controllers, tablets) ↔ Cloud layer (AI engine, optimization, analytics)

**Why Now / Vision CTA**
- "AI + low-cost sensors + ERP APIs make industrial intelligence affordable"
- Final CTA: "Request a Pilot" + "Watch Demo"

### Keep unchanged
- `LandingFooter` component
- `PublicChatWidget` component
- Header navigation structure (logo, sign in, get started)

### Remove from Landing.tsx
- `TestimonialSection` (not relevant to new positioning)
- `ProductShowcase` (product catalog doesn't fit industrial brain narrative)
- `ServicesGrid` (services listing replaced by modules)
- `QuoteRequestBanner` (replaced by pilot request CTA)
- `TrustBadges` (replaced by new competitive positioning)

### Update `ServicesGrid.tsx` → keep file but no longer imported in Landing

No new files needed — all changes contained in `Landing.tsx`.

