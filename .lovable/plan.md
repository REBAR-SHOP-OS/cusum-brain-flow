

# Plan: Nila Interpreter — Switch from GPT to Gemini

## Change

### File: `supabase/functions/translate-message/index.ts`

Line 90-93: Switch the `callAI` provider from GPT-5 to Gemini Flash:

**Before:**
```typescript
provider: "gpt",
model: "gpt-5",
temperature: 1.0,
```

**After:**
```typescript
provider: "gemini",
model: "gemini-2.5-flash",
temperature: 0.5,
```

This changes Nila's translation engine from OpenAI GPT-5 to Google Gemini 2.5 Flash — faster, cheaper, and no GPT temperature constraint.

