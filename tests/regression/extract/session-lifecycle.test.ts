// @vitest-environment node
/**
 * Regression: extract session lifecycle must always reach a terminal state.
 *
 * The original bug: after AI extraction completed and rows were saved, the
 * session could be left permanently in status="extracting" — usually because
 * the edge worker was killed between writing rows and writing the final
 * status update. The UI then spun forever on
 *   "AI extracting... (processing in background)".
 *
 * These tests pin the three guarantees that prevent that infinite loading:
 *
 *  1. The upload poll loop self-promotes a session to "extracted" when rows
 *     have landed but the status hasn't advanced.
 *  2. The poll loop has a hard timeout that flips the session to "error" so
 *     the user is never stuck — there is a Retry path, not a spinner.
 *  3. `useExtractRows` reconciles a stuck "extracting" session on any plain
 *     fetch (e.g. a browser refresh), independent of the upload flow.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..", "..");
const aiExtractView = readFileSync(
  join(repoRoot, "src/components/office/AIExtractView.tsx"),
  "utf8"
);
const extractSessionsHook = readFileSync(
  join(repoRoot, "src/hooks/useExtractSessions.ts"),
  "utf8"
);
const extractService = readFileSync(
  join(repoRoot, "src/lib/extractService.ts"),
  "utf8"
);
const extractManifest = readFileSync(
  join(repoRoot, "supabase/functions/extract-manifest/index.ts"),
  "utf8"
);

describe("extract session lifecycle — no infinite extracting", () => {
  it("upload poll self-promotes session when rows have landed but status is stuck", () => {
    // The poll loop must count rows for the session and, if any rows are
    // present while status is still "extracting", update the session to
    // "extracted" instead of waiting forever.
    expect(aiExtractView).toMatch(/from\(["']extract_rows["']\)[\s\S]{0,200}count:\s*["']exact["']/);
    expect(aiExtractView).toMatch(
      /status:\s*["']extracted["'][\s\S]{0,200}\.eq\(["']id["'],\s*session\.id\)/
    );
    // Self-promote branch must be inside the "extracting" status reconciliation
    expect(aiExtractView).toMatch(/self-promoting session/);
  });

  it("upload poll has a hard timeout that flips the session to a terminal error state", () => {
    // The "timed out" path must not just throw — it must persist an "error"
    // status with a message so the UI can show Retry instead of a spinner.
    expect(aiExtractView).toMatch(
      /status:\s*["']error["'][\s\S]{0,200}timed out[\s\S]{0,200}\.eq\(["']id["'],\s*session\.id\)/i
    );
    expect(aiExtractView).toMatch(/throw new Error\(["']Extraction timed out["']\)/);
  });

  it("runExtract does not pre-mark the session as extracting before the backend claim", () => {
    // Regression for the manual UI failure: the client set status="extracting"
    // immediately before invoking extract-manifest. The backend claim guard then
    // saw a fresh extracting session and exited as "already_running", leaving
    // zero rows and no terminal status.
    const runExtractBlock = extractService.match(/export async function runExtract[\s\S]*?\n}\n/);
    expect(runExtractBlock, "runExtract block missing").not.toBeNull();
    expect(runExtractBlock![0]).not.toMatch(/\.update\(\{\s*status:\s*["']extracting["']/);
    expect(runExtractBlock![0]).toMatch(/invokeEdgeFunction\(["']extract-manifest["']/);
  });

  it("active-session lifecycle polling runs on the rendered stuck session, not only during upload", () => {
    // If a user refreshes or opens a recent EXTRACTING session, no upload
    // promise is active. The component must still poll the active session id,
    // count rows for that same id, self-promote after rows land, or timeout.
    const lifecycleBlock = aiExtractView.match(/useEffect\(\(\) => \{[\s\S]{0,4200}?\[extract-lifecycle\][\s\S]{0,2600}?window\.setInterval/);
    expect(lifecycleBlock, "active-session lifecycle poll missing").not.toBeNull();
    const block = lifecycleBlock![0];
    expect(block).toMatch(/activeSessionId/);
    expect(block).toMatch(/from\(["']extract_rows["']\)[\s\S]{0,220}\.eq\(["']session_id["'],\s*sessionId\)/);
    expect(block).toMatch(/selfPromoteReady/);
    expect(block).toMatch(/timeoutReady/);
  });

  it("prevents local overlay from spinning while DB status remains uploaded", () => {
    // Regression for the manual UI inconsistency: local processing showed
    // "AI extracting..." while the stepper still read Uploaded. Uploaded +
    // local processing must be polled, diagnosed, and converted to a clear
    // start failure instead of an indefinite spinner.
    expect(aiExtractView).toMatch(/\["uploaded",\s*"extracting"\]\.includes\(activeSession\.status\)/);
    expect(aiExtractView).toMatch(/status === ["']uploaded["'] && processing/);
    expect(aiExtractView).toMatch(/Extraction did not start\. Please retry\./);
    expect(aiExtractView).toMatch(/setProcessingStep\(["']Starting extraction\.\.\.["']\)/);
    expect(aiExtractView).toMatch(/localProcessing:\s*processing/);
    expect(aiExtractView).toMatch(/latestExtractManifestResponse/);
  });

  it("extract-manifest claim errors are fatal, not mislabeled as already_running", () => {
    // If the backend cannot update extract_sessions.status, the client must get
    // an actual start failure so Retry appears. Returning already_running here
    // hides the real error and leaves the UI in a false processing state.
    const claimBlock = extractManifest.match(/const \{ data: claimed, error: statusErr \}[\s\S]*?Session \$\{sessionId\} already being extracted/);
    expect(claimBlock, "claim block missing").not.toBeNull();
    expect(claimBlock![0]).toMatch(/throw new Error\(`Could not start extraction:/);
    expect(claimBlock![0]).toMatch(/statusErr\.message/);
  });

  it("useExtractRows reconciles a stuck session on plain refresh (no upload flow)", () => {
    // A browser refresh hits the hook directly, without the AIExtractView
    // poll loop. The hook itself must promote "extracting" → "extracted"
    // when rows are present, otherwise refresh leaves the UI stuck.
    expect(extractSessionsHook).toMatch(/reconciling session/);
    expect(extractSessionsHook).toMatch(
      /status:\s*["']extracted["'][\s\S]{0,200}\.eq\(["']id["'],\s*sessionId\)/
    );
    // Reconciliation only fires when rows were actually fetched
    expect(extractSessionsHook).toMatch(/if\s*\(\s*data\.length\s*>\s*0\s*\)/);
  });

  it("extract-manifest still writes the terminal success status after saving rows", () => {
    // Backend invariant the reconciler depends on: the function tries to
    // write status="extracted" after the batch upsert. If this regresses we
    // would silently rely on the client to finalize every session.
    expect(extractManifest).toMatch(
      /status:\s*["']extracted["'][\s\S]{0,200}progress:\s*100/
    );
  });

  it("extract-manifest still writes a terminal error status on failure", () => {
    // Backend invariant: a thrown error in the extraction block flips the
    // session to "error" so the UI shows Retry instead of staying extracting.
    expect(extractManifest).toMatch(
      /status:\s*["']error["'][\s\S]{0,300}error_message:/
    );
  });
});
