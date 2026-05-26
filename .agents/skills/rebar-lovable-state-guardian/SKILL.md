---
name: rebar-lovable-state-guardian
description: prevent lovable or ai app-builder agents from working from stale project state. use when editing, debugging, reviewing, deploying, or explaining a lovable-built app where recent changes sometimes disappear, previews show old behavior, the agent gives unrelated answers, cached builds or stale indexes are suspected, or the user needs a reliable workflow that forces source-of-truth validation, re-indexing, cache invalidation, and deterministic project-state checks before making changes.
---

# Rebar Lovable State Guardian

## Goal

Keep the app state deterministic. Before answering, editing, debugging, or deploying, prove that the current source, preview, index, and deployment target all refer to the same latest project state.

## Core Rule

Never trust memory, chat history, preview screenshots, or previous agent assumptions as the source of truth. Treat them as hints only. The source of truth is the latest committed/saved project files plus the active deployment target explicitly selected by the user.

## Mandatory Preflight

Before making any code change or giving a final explanation, perform this check:

1. Identify the active app/project/workspace.
2. Identify the active branch, environment, or version target if available.
3. Re-read the files directly related to the requested feature.
4. Check whether the visible preview could be stale because of cache, delayed build, service worker, CDN/edge cache, or old preview tab.
5. Check whether the agent index/retrieval may be stale because recent files are not being retrieved.
6. State which files or routes were verified.
7. If anything cannot be verified, say so and ask for the missing file, route, branch, or screenshot instead of guessing.

Use the checklist in `references/state-validation-checklist.md` when the issue involves missing recent changes, inconsistent previews, deployment mismatch, or agent confusion.

## Safe Workflow

### 1. Establish Source of Truth

Use this order of reliability:

1. Current saved project files
2. Latest Git commit or selected branch
3. Current build logs
4. Current deployed environment
5. Preview UI
6. Chat memory

If two sources disagree, do not continue as if both are true. Name the mismatch and resolve it first.

### 2. Reconstruct Context Fresh

For every request, rebuild context from the relevant files instead of relying on previous conversation memory. Read route files, page files, components, state stores, API calls, schema files, and environment/config files connected to the request.

### 3. Detect Stale-State Symptoms

Assume stale state when any of these happen:

- A recent UI change sometimes appears and sometimes disappears.
- The agent denies a change exists, then fixes itself after being challenged.
- Preview and source files disagree.
- Deployment and Lovable preview disagree.
- The same prompt gives different answers about current routes, components, or copy.
- The app works in one tab but not another.

### 4. Force a Resync Before Editing

When stale state is suspected, perform or request these actions before changing code:

- Re-open or refresh the project workspace.
- Re-read the relevant files.
- Rebuild the preview.
- Clear browser cache or test in an incognito/private window.
- Disable or unregister any service worker if the app is a PWA.
- Confirm the active branch/environment.
- Confirm the deploy target.
- Re-index/re-scan the project if the platform supports it.

### 5. Make Minimal Changes

Change only the files needed for the requested behavior. Do not refactor unrelated code while fixing stale-state issues. If a refactor is necessary, explain why before doing it.

### 6. Verify After Change

After editing, verify with at least one deterministic check:

- The changed text/component/route exists in source.
- The preview shows the same version.
- The build succeeds.
- The route or UI behavior matches the request.
- No old duplicate component is still being rendered.

## Response Contract

When responding to the user, use this structure:

1. `verified state`: list the files/routes/environment checked.
2. `likely cause`: choose cache, stale index, wrong branch/environment, duplicate component, failed build, or deployment mismatch.
3. `fix applied or requested`: say exactly what changed or what the user must do.
4. `verification`: explain how to confirm the latest state is now visible.

Do not give vague answers such as “it may be a bug” or “try refreshing” without first checking the state chain.

## Common Root Causes

### Stale Agent Index

The source changed, but the agent retrieval/index still returns old file content. Fix by forcing project re-scan/re-index and explicitly reading the relevant files.

### Cached Preview

The source is correct, but the preview tab, service worker, CDN, or build cache shows old UI. Fix by rebuilding, hard-refreshing, using incognito/private mode, or clearing the service worker/cache.

### Wrong Branch or Environment

The user changed one branch/environment but the agent or preview is looking at another. Fix by confirming the active branch and deploy target.

### Duplicate Components or Routes

The user edited one component, but another similar component is actually rendered. Fix by tracing the import path from the active route to the rendered component.

### Failed or Partial Build

The change exists in code but was not included in the running build. Fix the build error, rebuild, and verify the output.

## Anti-Hallucination Rules

- Do not claim a change is missing until the relevant file has been checked.
- Do not claim the app is fixed unless the source and preview/deployment have been verified.
- Do not rely on the user’s previous prompt as proof of current code state.
- Do not overwrite recent user changes to “restore” a stale version.
- Do not introduce a new architecture to solve a cache/index problem unless the user asks for refactoring.

## Useful Prompt To Run Inside Lovable

When the user asks for a diagnostic prompt, provide this:

```text
Before making any change, perform a full project-state verification. Do not rely on chat memory. Re-read the relevant files, identify the active route/component/import chain, confirm the active branch/environment/deploy target, and check whether the preview may be stale due to cache, service worker, delayed build, or stale index. Then respond with: verified files, likely cause, exact fix, and verification steps. If source and preview disagree, resolve that mismatch before editing code.
```
