

# Fix AI Introduction Email Template

## Problem
The AI-generated introduction emails contain placeholder text like `[Sales Rep Name]` instead of using a proper signature. The email should never include brackets or placeholder tokens.

## Changes

### 1. `supabase/functions/pipeline-ai/index.ts` -- Update `draft_intro` prompt (line ~390)

Update the prompt to explicitly instruct the AI:
- **Never** use placeholder brackets like `[Sales Rep Name]`, `[Your Name]`, etc.
- Always sign emails as "The rebar.shop Sales Team"
- Address the prospect by their first name (derived from contact_name)
- Keep the tone warm but direct -- no filler phrases like "I hope this finds you well"
- Open with a specific observation about the prospect's company/industry
- Close with a soft CTA (open to a brief chat?) and sign off cleanly

Updated prompt wording:
```
Draft a cold introduction email. CRITICAL RULES:
1. NEVER use placeholder text like [Sales Rep Name] or [Your Name] -- sign as "The rebar.shop Sales Team"
2. Address the recipient by first name only (e.g., "Hi Sarah,")
3. Open with a specific observation about their company or industry
4. Keep to 3-4 sentences max in the body
5. End with a soft call to action
6. Sign off: "Best regards,\nThe rebar.shop Sales Team"
```

### 2. `src/components/prospecting/ProspectIntroDialog.tsx` -- Pass first name in userMessage (line ~48)

Extract the first name from `prospect.contact_name` and pass it explicitly in the prompt context so the AI has a clean first name to use in the greeting.

## Result
Emails will look like:

```
Hi Sarah,

We noticed Windy City Structural Group specializes in high-density urban 
infrastructure -- an area where precision rebar fabrication makes a real 
difference. At rebar.shop, we provide advanced fabrication capabilities 
tailored for complex high-rise reinforcement with reliable scheduling.

Would you be open to a brief conversation about how we can support your 
upcoming projects?

Best regards,
The rebar.shop Sales Team
```

No more `[Sales Rep Name]` placeholders.
