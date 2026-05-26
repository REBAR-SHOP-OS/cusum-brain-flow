# Add "Rebar Lovable State Guardian" Skill

Install the uploaded skill into the workspace so it can be retrieved when working on Lovable state/cache/stale-index issues.

## Steps

1. Copy the extracted skill files from the upload into `.agents/skills/rebar-lovable-state-guardian/`:
   - `SKILL.md` (frontmatter: name + description already valid)
   - `references/state-validation-checklist.md`
   - `agents/openai.yaml` (interface metadata)
2. Call `skills--apply_draft` with `.agents/skills/rebar-lovable-state-guardian` to activate it.

## Notes

- No code or DB changes. Skill content used as-is from the zip (no edits needed — frontmatter, name, and description are compliant).
- Trigger: editing/debugging/deploying Lovable apps where stale state, cache, or stale index is suspected.

Switch to build mode to apply.
