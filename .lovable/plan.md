

# Restructure User Dashboard into Two Clear Sections

## Current State
When a user is selected in Vizzy Brain, the Performance Card and Agent Sessions appear as flat, separate blocks without clear grouping.

## Goal
Group content into two visually distinct sections:
1. **بخش کلی (General Overview)** — Performance card with clock-in, hours, activities, AI sessions
2. **بخش ایجنت‌ها (Agents)** — List of agents the user has worked with, each as a collapsible accordion showing session details/reports

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

**Wrap both sections in a tabbed or card-based layout:**

- Create a new `UserDashboard` component that wraps `PerformanceCard` and `UserAgentsSections` into two clearly labeled sections with styled headers
- Section 1: "📊 General Overview" — contains the existing PerformanceCard content
- Section 2: "🤖 Agents" — contains the existing UserAgentsSections with each agent name and collapsible accordion for work reports

**Visual structure:**
```text
┌──────────────────────────────┐
│ 📊 General Overview          │
│ ┌──────────────────────────┐ │
│ │ In: 8:01 AM  Hours: 7h   │ │
│ │ Activities: 0  AI: 0     │ │
│ └──────────────────────────┘ │
│                              │
│ 🤖 Agents                    │
│ ▸ Vizzy (1 session)          │
│ ▸ Dashboard (0)              │
│ ▸ Inbox (0)                  │
│ ▸ Team Hub (0)               │
│ ▸ Business Tasks (1)         │
│ ▸ Live Monitor (0)           │
│ ▸ CEO Portal (0)             │
│ ▸ Support (0)                │
└──────────────────────────────┘
```

- Each agent row expands to show recent conversation messages (already implemented in `UserAgentsSections`)
- Agents with 0 sessions still appear in the list but show "No messages" when expanded
- Both sections have clear visual separation with labeled headers and subtle borders

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — restructure user dashboard layout into two labeled sections

