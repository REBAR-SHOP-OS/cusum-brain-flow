
# Odoo CRM Pipeline UI Overhaul -- Visual Only

## Overview
Restyle the Pipeline page and all its sub-components to closely match the Odoo 17 CRM Kanban + Form view, as shown in the reference screenshot. No data model, logic, API, permission, or database changes.

## Files to Modify (UI only)

### 1. `src/pages/Pipeline.tsx` -- Header Restructure
- Restyle the top bar to match Odoo: left-aligned "Pipeline" title with lead count, "New" button prominent on the right (Odoo-style: solid bg, low border-radius)
- Move AI toggle and overflow menu into a compact right-side group
- Keep PipelineFilters search bar as-is (already Odoo-style)

### 2. `src/components/pipeline/PipelineColumn.tsx` -- Column Styling
- Remove rounded-lg, use subtle border-right separator between columns (Odoo style)
- Column header: stage label left, count right, thin bottom border
- Keep activity status bar but make it thinner/subtler
- Background: white/card color instead of secondary/30 tint
- Reduce padding to match Odoo's compact feel

### 3. `src/components/pipeline/LeadCard.tsx` -- Card Redesign (Odoo Kanban Card)
- Flat card style: very low border-radius (rounded-sm), subtle border, no shadow on idle, light shadow on hover
- Layout:
  - Top: Lead title (bold, 13-14px) with optional email icon
  - Below title: customer/company name (12px, muted)
  - Bottom row: star rating (left), revenue amount (right), salesperson avatar circle (far right)
- Remove Card/CardContent wrapper, use plain div with border for Odoo parity
- Activity status dot remains but smaller

### 4. `src/components/pipeline/LeadDetailDrawer.tsx` -- Right Panel (Odoo Form)
- Sheet width: increase to ~45% on desktop (`sm:max-w-[45vw]`)
- Header section:
  - Large lead title (18-20px)
  - Priority/age badges beside title
  - Edit (pencil) and close (x) icons top-right
- Stage ribbon below header: horizontal scrollable stage steps styled as Odoo breadcrumb arrows (not rounded pills). Active stage highlighted, previous stages tinted.
- Info section: two-column grid showing Customer, Email, Phone, Salesperson (with avatar), Revenue, Probability (with thin progress bar), Expected Closing, Tags -- matching Odoo's form layout with label-above-value pattern
- Tabs section: keep Notes / Chatter / Activities tabs but style the tab bar like Odoo (underline-style tabs, not pill tabs)
- Footer: creation date left, delete/archive right, updated date far right

### 5. `src/components/pipeline/OdooChatter.tsx` -- Chatter Styling
- Composer tab bar: "Send message | Log note | Schedule activity" buttons styled as Odoo (the active one gets a colored background, e.g., green for Send message)
- Note composer background: light yellow (already done)
- Thread items: tighter spacing, Odoo-style timestamp alignment
- No logic changes

### 6. `src/components/pipeline/PipelineBoard.tsx` -- Board Container
- Remove gap-4 between columns, use gap-0 with border separators
- Background: neutral white/light grey (not tinted)
- Ensure horizontal scroll remains smooth

## Styling Principles (Odoo 17 Parity)
- Font sizes: body 13px, card titles 13-14px, drawer title 18-20px
- Border-radius: 2-4px max (not rounded-lg/xl)
- Colors: white cards, light grey backgrounds, thin grey borders
- No gradients, no heavy shadows
- Buttons: low border-radius, solid fills for primary actions
- Stage ribbon: chevron/breadcrumb style with arrow separators

## What Will NOT Change
- Database schema, tables, RLS policies
- Lead data model, stage logic, drag-and-drop behavior
- API calls, mutations, queries
- Permissions, authentication
- Any page or component outside the pipeline directory
