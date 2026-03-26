

# Add Video Model Selector to Chat Bar

## What
Add a model selector button (with a CPU/Film icon) to the ChatPromptBar toolbar, allowing users to choose which AI video model to use. The currently used models in the backend are displayed as selectable options.

## Available Models (from `generate-video` edge function)

| Provider | Model | Label |
|---|---|---|
| wan | wan2.6-t2v | Wan T2V |
| wan | wan2.6-i2v | Wan I2V |
| wan | wan2.6-i2v-flash | Wan I2V Flash |
| veo | veo-3.1-generate-preview | Veo 3.1 |
| sora | sora-2 | Sora 2 |

## Changes

### `src/components/ad-director/ChatPromptBar.tsx`

1. **Add model list constant**:
```ts
const VIDEO_MODELS = [
  { key: "wan2.6-t2v", provider: "wan", label: "Wan T2V", description: "Text to Video - 1080P" },
  { key: "wan2.6-i2v", provider: "wan", label: "Wan I2V", description: "Image to Video" },
  { key: "wan2.6-i2v-flash", provider: "wan", label: "Wan I2V Flash", description: "Fast Image to Video" },
  { key: "veo-3.1-generate-preview", provider: "veo", label: "Veo 3.1", description: "Google Video Gen" },
  { key: "sora-2", provider: "sora", label: "Sora 2", description: "OpenAI Video Gen" },
];
```

2. **Add state**: `const [selectedModel, setSelectedModel] = useState(VIDEO_MODELS[0])` (default: wan2.6-t2v)

3. **Add Popover** between Products and auto-generate button, styled like the other toolbar pills (with `Clapperboard` or `Cpu` icon). Shows the selected model name and a dropdown with all models, each showing label + short description.

4. **Update props/onSubmit**: Add `selectedModel` and `selectedProvider` to the `onSubmit` signature so the parent can pass them to the edge function.

### `src/components/ad-director/AdDirectorContent.tsx`
- Update the `handleSubmit` call to accept and forward the selected model/provider to `generate-video` instead of hardcoding `provider: "wan", model: "wan2.6-t2v"`.

### `src/lib/backgroundAdDirectorService.ts`
- Update to accept and use the selected model/provider passed from the parent.

| File | Change |
|---|---|
| `ChatPromptBar.tsx` | Add VIDEO_MODELS constant, selectedModel state, model selector Popover, update onSubmit signature |
| `AdDirectorContent.tsx` | Forward selected model/provider to edge function |
| `backgroundAdDirectorService.ts` | Accept and use dynamic model/provider |

