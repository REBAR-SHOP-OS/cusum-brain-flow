# State Validation Checklist

Use this checklist when a Lovable app does not show the latest changes or the agent appears to reason from an old project state.

## A. Project Identity

- Confirm app/project name.
- Confirm active workspace/account.
- Confirm active branch or version if the platform exposes one.
- Confirm target environment: local preview, Lovable preview, staging, or production.

## B. Source Verification

- Re-read the route/page file for the affected screen.
- Trace imports from route to rendered component.
- Search for duplicate components with similar names.
- Check shared layout, navigation, state/store, and feature flag files.
- Confirm the requested text/UI/logic exists in the rendered component, not only in an unused file.

## C. Build and Preview Verification

- Rebuild or restart preview.
- Check build logs for errors or warnings.
- Hard refresh the preview tab.
- Test in incognito/private mode.
- If PWA/service worker exists, unregister it and clear site data.
- Compare preview route with the edited route.

## D. Deployment Verification

- Confirm which environment was deployed.
- Confirm latest deployment timestamp if available.
- Confirm build source branch/version.
- Check whether CDN/edge cache may be serving older assets.

## E. Agent Retrieval Verification

- Ask the agent to list the exact files it read.
- Ask the agent to quote the current component name/import path.
- If it cannot identify the file path, force a re-scan before editing.
- If it reads old content, treat the index as stale and refresh/re-index.

## F. Final Verification

A fix is complete only when:

- The correct source file contains the intended change.
- The active route imports that file.
- The current build includes that file.
- The visible preview/deployment shows the same behavior.
