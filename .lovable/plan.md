

# Grant zahra@rebar.shop the same Social Media / Pixel agent access as radin@rebar.shop

## What's missing

Comparing radin's access to zahra's current state:

| Access Point | radin@rebar.shop | zahra@rebar.shop | Fix needed |
|---|---|---|---|
| `/social-media-manager` route | ✅ (admin) | ✅ (via `allowedEmails`) | No |
| Social Media Manager card on dashboard | ✅ (admin) | ✅ (already added) | No |
| Agent workspace → Pixel agent (`/agent/social`) | ✅ (via `userAgentMap`) | ❌ No mapping | **Yes** |
| `userAgentMap.ts` — hero text & quick actions | ✅ "Pixel" agent with AI/Systems prompts | ❌ Not present | **Yes** |

## Changes — 1 file

### `src/lib/userAgentMap.ts`
Add a `"zahra@rebar.shop"` entry mapping her to the `"social"` agent (Pixel), with social-media-focused quick actions:

```ts
"zahra@rebar.shop": {
  agentKey: "social",
  userRole: "social_media_manager",
  heroText: "How can **Pixel** assist you today?",
  quickActions: [
    { title: "Generate post", prompt: "Create a new social media post for today — pick the best platform and generate a caption and image.", icon: "Sparkles", category: "Content" },
    { title: "Weekly content plan", prompt: "Plan this week's social media content — suggest topics, platforms, and posting times.", icon: "Calendar", category: "Planning" },
    { title: "Post performance", prompt: "Show me how our recent social media posts have performed — engagement, reach, and top performers.", icon: "TrendingUp", category: "Analytics" },
    { title: "Brand consistency", prompt: "Review our latest posts for brand consistency — logo usage, tone, and visual style.", icon: "Eye", category: "Brand" },
  ],
},
```

This gives zahra the same Pixel agent experience as radin when she visits `/agent/social`, with quick actions tailored to her social media management role.

