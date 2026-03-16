

# Add Estimated Cost per Model to AI Token Usage Card

## What
Enhance the `AITokenUsageCard` to show estimated USD cost for each model based on token usage, plus a total estimated spend KPI.

## Pricing Table (per 1M tokens, Lovable AI gateway rates)

| Model | Input $/1M | Output $/1M |
|-------|-----------|-------------|
| google/gemini-2.5-pro | $1.25 | $10.00 |
| google/gemini-3.1-pro-preview | $1.25 | $10.00 |
| google/gemini-3-flash-preview | $0.10 | $0.40 |
| google/gemini-2.5-flash | $0.15 | $0.60 |
| google/gemini-2.5-flash-lite | $0.02 | $0.10 |
| openai/gpt-5 | $10.00 | $30.00 |
| openai/gpt-5-mini | $1.10 | $4.40 |
| openai/gpt-5-nano | $0.10 | $0.40 |
| openai/gpt-5.2 | $12.00 | $40.00 |
| openai/gpt-4o | $2.50 | $10.00 |
| google/gemini-2.5-flash-image | $0.15 | $0.60 |
| google/gemini-3-pro-image-preview | $1.25 | $10.00 |
| google/gemini-3.1-flash-image-preview | $0.10 | $0.40 |

## Changes

### 1. Modify `src/components/ceo/AITokenUsageCard.tsx`

- Add a `MODEL_PRICING` constant map with input/output cost per 1M tokens for all models
- Compute `estimatedCost` per model row using: `(prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000`
- Add a new KPI card in the summary row: **"Est. Cost"** showing total USD
- Update the "By Model" list to show cost next to token count (e.g. `Gemini 2.5 Flash — 1.2M — $0.84`)
- Add a cost column to the model breakdown sorted by cost descending
- Unknown models default to a mid-tier rate ($1.00/$4.00) as fallback

### 2. Update `src/types/adDirector.ts` AVAILABLE_MODELS

- Add all missing models (gpt-5-nano, gpt-5.2, gemini-3-flash-preview, gemini-3.1-pro-preview, image models) so the Ad Director model selector also shows the full list

## Result
The CEO portal shows estimated dollar spend per model and total, giving clear visibility into AI costs across the platform.

