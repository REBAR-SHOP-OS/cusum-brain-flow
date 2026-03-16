

# Add USA Visitor Handling to Website Chat Prompt

## Change
Add a new section to the `SYSTEM_PROMPT` in `supabase/functions/website-chat/index.ts` that instructs the AI to:

1. If a visitor is from the USA (detected via geo-location data already passed in the greeting, or if they mention being in the US), politely let them know we don't currently offer services in the USA.
2. If they are a rebar fabricator interested in partnering, let them know we're open to discussing partnership opportunities and direct them to reach out.

## File
`supabase/functions/website-chat/index.ts` — add a new `## USA Visitors` section to the system prompt, before the Guidelines section (around line 78):

```
## USA & International Visitors
- If a visitor is from the United States (detected from their location, or if they mention being in the US/USA/America), politely let them know:
  "Thanks for reaching out! At the moment, we're based in Sydney, Australia and don't currently offer rebar fabrication services in the United States. We hope to expand in the future!"
- However, if the visitor is a rebar fabricator themselves and expresses interest in partnering, collaborating, or working together, warmly welcome the conversation:
  "That said, if you're a fellow rebar fabricator and interested in exploring a partnership, we'd love to chat! Please reach out to us directly and we can set up a conversation."
- For visitors from other countries outside Australia, still be helpful but mention our delivery is limited to the Greater Sydney region
```

Single file edit, prompt-only change. No database or UI modifications needed.

