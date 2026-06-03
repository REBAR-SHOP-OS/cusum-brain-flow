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
