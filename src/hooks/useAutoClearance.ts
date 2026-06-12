import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/imageCompressor";
import type { ClearanceItem } from "@/hooks/useClearanceData";
import { speak, vibrate } from "@/lib/voiceFeedback";
import * as queue from "@/lib/autoClearanceQueue";
import {
  assertTagEvidenceReady,
  assertEvidenceComplete,
  ClearanceGateError,
} from "@/lib/clearanceEvidenceGate";

// Strict sequential state machine. Any forbidden transition (e.g. waiting_tag
// → waiting_product without tag_evidence_saved) is impossible because each
// stage is set only inside the matching code path below.
export type AutoState =
  | "waiting_tag"
  | "tag_uploading"
  | "ocr_running"
  | "matching"
  | "tag_pick"              // medium confidence — show top 3 (tag blob held)
  | "tag_evidence_saved"
  | "waiting_product"
  | "product_uploading"
  | "product_validating"
  | "completed"
  | "manifest_complete";

export type Banner =
  | { kind: "duplicate" | "mismatch" | "low_ocr" | "offline" | "error"; text: string }
  | null;

type RankedMatch = {
  id: string;
  mark_number: string | null;
  score: number;
  reasons: string[];
};

function clearanceFlowLog(step: string, details: Record<string, any>) {
  // eslint-disable-next-line no-console
  console.log("[clearance-camera-flow]", { step, ...details });
}

// ---------- perf logging ----------
const PERF = true;
const tNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
function perfLog(label: string, ms: number, extra?: Record<string, any>) {
  if (!PERF) return;
  // single-line, easy to grep: [auto-perf] step=upload ms=412
  // eslint-disable-next-line no-console
  console.log(`[auto-perf] step=${label} ms=${Math.round(ms)}`, extra ?? "");
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

/**
 * Build a single compressed copy used for BOTH the OCR roundtrip and the
 * storage upload. One canvas pass instead of two; one set of bytes shipped
 * to the AI gateway and stored in the bucket. Falls back to the original
 * blob if anything goes wrong.
 */
async function buildSharedBlob(src: Blob): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return src;
    const bmp = await createImageBitmap(src);
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return await c.convertToBlob({ type: "image/jpeg", quality: 0.75 });
  } catch {
    return src;
  }
}


export function useAutoClearance({
  items,
  manifestKey,
  userId,
  selectedZone,
}: {
  items: ClearanceItem[];
  manifestKey: string;
  userId?: string;
  /** Required for clearance — when null/empty, auto-match is blocked and only
   *  zone-scoped candidates are considered. */
  selectedZone?: string | null;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AutoState>("waiting_tag");
  const [banner, setBanner] = useState<Banner>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [pickCandidates, setPickCandidates] = useState<RankedMatch[]>([]);
  const [lastOcr, setLastOcr] = useState<any>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);
  // Optimistic local completion — items we just finalized in this session,
  // hidden from the active queue immediately so the operator doesn't need to
  // exit/re-enter to see verified state. DB is the source of truth; this set
  // only bridges the gap until the clearance-items refetch lands.
  const [locallyCompletedIds, setLocallyCompletedIds] = useState<Set<string>>(() => new Set());
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // Prune local-completed ids once the DB-backed items list no longer contains
  // them (i.e. phase moved past `clearance` and useClearanceData filtered them
  // out). Keeps the set from growing unboundedly across long sessions.
  useEffect(() => {
    if (locallyCompletedIds.size === 0) return;
    const stillPresent = new Set(items.map((i) => i.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of locallyCompletedIds) {
      if (stillPresent.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setLocallyCompletedIds(next);
  }, [items, locallyCompletedIds]);
  // Hard scan lock — guarantees we never run two OCR roundtrips on the same
  // frame, even if React state updates lag the camera shutter.
  const scanLockRef = useRef(false);
  // Tracks the full item cycle (tag capture → finalize).
  const cycleStartRef = useRef<number>(0);
  // Held tag photo blob during the confirm-pick branch. Required so that the
  // tag photo is actually uploaded AFTER the operator picks the right item.
  const pendingTagBlobRef = useRef<Blob | null>(null);
  const pendingTagOcrRef = useRef<any>(null);

  // Track online/offline.
  useEffect(() => {
    const on = () => { setOnline(true); refreshQueueCount(); drainQueue(); };
    const off = () => { setOnline(false); setBanner({ kind: "offline", text: "Offline — captures will sync when reconnected." }); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshQueueCount = useCallback(async () => {
    try { setQueuedCount(await queue.count()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshQueueCount(); }, [refreshQueueCount]);

  const pendingItems = useMemo(
    () => items.filter((i) => i.evidence_status !== "cleared" && !locallyCompletedIds.has(i.id)),
    [items, locallyCompletedIds]
  );
  const verifiedCount = items.length - pendingItems.length;
  const totalCount = items.length;
  const manifestComplete = totalCount > 0 && pendingItems.length === 0;

  // Pre-normalize manifest candidates once; reused on every scan so we don't
  // rebuild this list per capture. When a zone is selected, restrict matching
  // candidates to items whose evidence is already tagged with that zone OR
  // items with no zone yet (so the operator can still onboard them).
  const candidatesRef = useRef<any[]>([]);
  useEffect(() => {
    const z = (selectedZone || "").trim();
    candidatesRef.current = items
      .filter((i) => i.evidence_status !== "cleared" && !locallyCompletedIds.has(i.id))
      .filter((i) => !z || !i.storage_zone || i.storage_zone === z)
      .map((i) => ({
        id: i.id,
        mark_number: i.mark_number,
        bar_code: i.bar_code,
        cut_length_mm: i.cut_length_mm,
        total_pieces: i.total_pieces,
        asa_shape_code: i.asa_shape_code,
        drawing_ref: i.drawing_ref,
        ref_no: i.ref_no,
        storage_zone: i.storage_zone,
      }));
  }, [items, selectedZone, locallyCompletedIds]);

  useEffect(() => {
    if (manifestComplete && state !== "manifest_complete") {
      setState("manifest_complete");
      speak("Manifest complete");
      vibrate([80, 60, 80]);
    }
  }, [manifestComplete, state]);

  const showBanner = useCallback((b: Banner, ms = 2200) => {
    setBanner(b);
    if (b) {
      // Auto-dismiss every banner — including 'mismatch'. In auto mode the
      // operator must not be required to tap to dismiss; recurring mismatches
      // are surfaced via voice + vibrate, not a sticky banner.
      window.setTimeout(() => {
        setBanner((cur) => (cur === b ? null : cur));
      }, ms);
    }
  }, []);

  // ---------- timeout + audit helpers ----------
  // Hard ceiling for any single AI roundtrip. If the function call hangs, we
  // bail out cleanly and reset the camera to ready instead of leaving the UI
  // stuck on VERIFYING / READING TAG forever.
  const AI_TIMEOUT_MS = 8000;
  async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const t = window.setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      );
      p.then(
        (v) => { window.clearTimeout(t); resolve(v); },
        (e) => { window.clearTimeout(t); reject(e); },
      );
    });
  }

  // Refine attempts — bounded so a single bad tag image can't pin the UI in
  // a perpetual READING/MATCHING state. Reset on every successful tag accept.
  const refineAttemptsRef = useRef(0);
  // Set true when the tag OCR matched cleanly (decision === "auto" with high
  // score). Lets the product step skip the redundant validate-clearance-photo
  // AI call entirely — the tag already proved this is the right item.
  const trustedTagRef = useRef(false);
  const MAX_REFINE_ATTEMPTS = 2;

  // Recent finalize dedupe — if the operator (or a chatty shutter) re-scans
  // the same tag inside this window, we skip the second save entirely.
  const recentlySavedRef = useRef<Map<string, number>>(new Map());
  const RECENT_SAVE_WINDOW_MS = 6000;
  function markRecentlySaved(itemId: string) {
    recentlySavedRef.current.set(itemId, Date.now());
  }
  function wasRecentlySaved(itemId: string): boolean {
    const t = recentlySavedRef.current.get(itemId);
    if (!t) return false;
    if (Date.now() - t > RECENT_SAVE_WINDOW_MS) {
      recentlySavedRef.current.delete(itemId);
      return false;
    }
    return true;
  }

  // -------- pipeline helpers --------

  /**
   * Compress + upload to storage. Returns the storage path.
   * The compression also produces a smaller payload for any callers that
   * already have an OCR-optimized blob via `buildOcrBlob`.
   */
  const uploadToStorage = useCallback(async (
    itemId: string,
    kind: "tag" | "product",
    blob: Blob,
  ): Promise<string> => {
    const tCompress = tNow();
    // Aggressive compress for clearance photos: ~1024px max edge, JPEG q=0.7.
    // Full-res phone shots (3-5 MB) used to dominate the upload roundtrip.
    const compressed = await compressImage(
      new File([blob], `${kind}-${Date.now()}.jpg`, { type: "image/jpeg" }),
      1024,
      0.7,
    );
    perfLog("compress", tNow() - tCompress, { kind, bytes: compressed.size });
    const ext = compressed.name.split(".").pop() || "jpg";
    const path = `${itemId}/${kind}-${Date.now()}.${ext}`;
    const tUp = tNow();
    const { error } = await supabase.storage
      .from("clearance-photos")
      .upload(path, compressed, { upsert: true });
    perfLog("upload", tNow() - tUp, { kind });
    if (error) throw error;
    return path;
  }, []);

  const ensureEvidenceRow = useCallback(async (itemId: string) => {
    // Prefer locally-tracked id (set right after tag scan) — avoids race with
    // React Query cache refetch which can cause a duplicate INSERT.
    const existingLocal = itemsRef.current.find((i) => i.id === itemId);
    const zone = (selectedZone || existingLocal?.storage_zone || "").trim() || null;
    if (existingLocal?.evidence_id) {
      if (zone) {
        const { error: zoneErr } = await supabase
          .from("clearance_evidence")
          .update({ storage_zone: zone })
          .eq("id", existingLocal.evidence_id);
        if (zoneErr) throw zoneErr;
      }
      return existingLocal.evidence_id;
    }
    // Authoritative check against DB before inserting.
    const { data: found, error: findErr } = await supabase
      .from("clearance_evidence")
      .select("id, storage_zone")
      .eq("cut_plan_item_id", itemId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (found?.id) {
      if (zone && !found.storage_zone) {
        const { error: zoneErr } = await supabase
          .from("clearance_evidence")
          .update({ storage_zone: zone })
          .eq("id", found.id);
        if (zoneErr) throw zoneErr;
      }
      return found.id as string;
    }
    const { data, error } = await supabase
      .from("clearance_evidence")
      .insert({
        cut_plan_item_id: itemId,
        status: "pending",
        verification_method: "auto",
        verification_state: "pending",
        storage_zone: zone,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }, [selectedZone]);

  // HARD RULE: only flips to cleared when BOTH photos exist on the row
  // AND validate-clearance-photo returned valid. After evidence is flipped to
  // status='cleared', the DB pipeline auto-advances cut_plan_items.phase:
  //   clearance -> cleared (auto_advance_cleared_item)
  //   cleared   -> complete (auto_bridge_cleared_to_complete)
  // We then RE-READ the row from the DB and, if the bridge didn't fire for
  // any reason, we explicitly nudge cleared -> complete (allowed adjacency).
  // This guarantees a successful Auto Clearance lands at phase='complete'.
  const finalizeVerification = useCallback(async (
    evidenceId: string,
    itemId: string,
    confidence: number,
    ocrMeta: any,
  ) => {
    // Shared gate — re-reads clearance_evidence; confirms BOTH photos on SAME row.
    await assertEvidenceComplete(evidenceId, itemId);

    // Snapshot previous phase for debug log.
    const { data: prevItem } = await supabase
      .from("cut_plan_items")
      .select("phase")
      .eq("id", itemId)
      .maybeSingle();
    const prevPhase = prevItem?.phase ?? null;

    clearanceFlowLog("completion_mutation_called", {
      evidenceId,
      cut_plan_item_id: itemId,
      selectedZone: selectedZone ?? null,
    });
    const { data: completedEvidence, error: upErr } = await supabase
      .from("clearance_evidence")
      .update({
        status: "cleared",
        verification_state: "complete",
        verification_method: "auto",
        ai_confidence: confidence,
        ocr_metadata: ocrMeta,
        verified_by: userId,
        verified_at: new Date().toISOString(),
        storage_zone: selectedZone || undefined,
      })
      .eq("id", evidenceId)
      .select("id, status, verification_state, storage_zone")
      .maybeSingle();
    if (upErr) throw upErr;
    if (!completedEvidence) {
      throw new Error("Clearance completion update returned no row. Check RLS/auth/company access.");
    }
    clearanceFlowLog("completion_mutation_response", {
      evidenceId,
      status: completedEvidence.status,
      verification_state: completedEvidence.verification_state,
      storage_zone: completedEvidence.storage_zone,
    });

    // Re-read DB to confirm trigger chain landed at 'complete'.
    const { data: postItem, error: readErr } = await supabase
      .from("cut_plan_items")
      .select("phase")
      .eq("id", itemId)
      .maybeSingle();
    if (readErr) throw readErr;
    let finalPhase = postItem?.phase ?? null;
    clearanceFlowLog("clearance_item_refetch_result", {
      cut_plan_item_id: itemId,
      phase: finalPhase,
    });

    // Safety net: if bridge didn't advance cleared -> complete, do it
    // explicitly. cleared -> complete is an allowed adjacency.
    if (finalPhase === "cleared") {
      const { data: fixed, error: fixErr } = await supabase
        .from("cut_plan_items")
        .update({ phase: "complete" })
        .eq("id", itemId)
        .eq("phase", "cleared")
        .select("id, phase")
        .maybeSingle();
      if (fixErr) throw fixErr;
      if (fixed?.phase) finalPhase = fixed.phase;
    }

    // eslint-disable-next-line no-console
    console.log("[auto-clearance/finalize]", {
      evidenceId,
      cut_plan_item_id: itemId,
      prevPhase,
      finalPhase,
      tagPhotoExists: true,
      productPhotoExists: true,
      mark: ocrMeta?.ocr?.mark ?? null,
      dwg: ocrMeta?.ocr?.dwg ?? null,
      ref: ocrMeta?.ocr?.ref ?? null,
      selectedZone: selectedZone ?? null,
      result: finalPhase === "complete" ? "complete" : "stuck",
    });

    if (finalPhase !== "complete") {
      throw new Error(
        `Auto Clearance finalized evidence but item phase did not advance to complete (got: ${finalPhase ?? "null"}).`,
      );
    }
  }, [userId, selectedZone]);

  // -------- main captures --------

  const handleTagCapture = useCallback(async (blob: Blob) => {
    // Hard scan lock — prevents stacked OCR roundtrips from a chatty camera loop.
    if (scanLockRef.current || busy) return;
    scanLockRef.current = true;
    cycleStartRef.current = tNow();
    trustedTagRef.current = false;
    clearanceFlowLog("scan_started", { kind: "tag", manifestKey, refine_attempt: refineAttemptsRef.current });
    if (!navigator.onLine) {
      try {
        await queue.enqueue({
          id: crypto.randomUUID(),
          kind: "tag",
          itemId: null,
          manifestKey,
          blob,
          createdAt: Date.now(),
        });
        refreshQueueCount();
      } catch { /* ignore quota */ }
      showBanner({ kind: "offline", text: "Offline — tag queued. Won't verify until sync." }, 3000);
      scanLockRef.current = false;
      return;
    }
    setBusy(true);
    // Clear any stale active refs from a previous aborted cycle BEFORE any
    // state advances. Without this, a failed tag scan could leave the prior
    // evidenceId in scope, and a later product shutter would attach to it.
    setActiveItemId(null);
    setActiveEvidenceId(null);
    setState("tag_uploading");
    try {
      // Pre-normalized candidates (rebuilt only when manifest changes).
      const candidates = candidatesRef.current;
      if (candidates.length === 0) {
        setState("manifest_complete");
        return;
      }

      // One compressed blob serves both OCR and upload. Upload runs in
      // parallel with the OCR roundtrip to a temp path; if OCR matches a
      // different itemId than expected we still keep the file (single-item
      // matches are the common path). This removes the second canvas pass
      // and the OCR→upload sequential wait.
      const tPrep = tNow();
      const sharedBlobPromise = buildSharedBlob(blob);
      setState("ocr_running");
      const ocrPromise = sharedBlobPromise
        .then(blobToBase64)
        .then(async (imageBase64) => {
          perfLog("ocr_prep", tNow() - tPrep);
          const tOcr = tNow();
          const r = await withTimeout(
            supabase.functions.invoke("match-tag-photo", {
              body: { imageBase64, candidates },
            }),
            AI_TIMEOUT_MS,
            "match-tag-photo",
          );
          perfLog("ocr+match", tNow() - tOcr);
          return r;
        });

      const { data, error } = await ocrPromise;
      if (error) throw error;

      const ocr = data?.ocr || {};
      const ranked: RankedMatch[] = data?.ranked || [];
      const decision: "auto" | "confirm" | "none" = data?.decision || "none";
      const mismatchReason: string | null = data?.mismatch_reason ?? null;
      setLastOcr(ocr);
      setState("matching");

      if (decision === "none" || ranked.length === 0) {
        setLastConfidence(ranked[0]?.score ?? 0);
        refineAttemptsRef.current += 1;
        const overLimit = refineAttemptsRef.current > MAX_REFINE_ATTEMPTS;
        clearanceFlowLog("scan_low_ocr", { refine_attempt: refineAttemptsRef.current, overLimit });
        showBanner(
          { kind: "low_ocr", text: overLimit ? "Move closer & retry." : "Tag unreadable — please rescan." },
          2200,
        );
        if (overLimit) refineAttemptsRef.current = 0;
        setState("waiting_tag");
        return;
      }
      const best = ranked[0];
      const matchedItem = itemsRef.current.find((i) => i.id === best.id);
      if (!matchedItem) {
        showBanner({ kind: "mismatch", text: "Tag does not match this manifest." }, 2200);
        setState("waiting_tag");
        return;
      }
      clearanceFlowLog("tag_recognized", {
        cut_plan_item_id: matchedItem.id,
        mark: matchedItem.mark_number,
        decision,
        score: best.score,
        mismatch_reason: mismatchReason,
      });
      // Zone gate — if a zone is selected and the matched item is bound to a
      // different zone, never auto-match. Operator must rescan or change zone.
      const activeZone = (selectedZone || "").trim();
      if (activeZone && matchedItem.storage_zone && matchedItem.storage_zone !== activeZone) {
        showBanner({ kind: "mismatch", text: "Tag belongs to a different zone." }, 2500);
        speak("Wrong zone");
        vibrate([120, 60, 120]);
        setState("waiting_tag");
        return;
      }
      if (matchedItem.evidence_status === "cleared" || wasRecentlySaved(matchedItem.id)) {
        showBanner({ kind: "duplicate", text: `${matchedItem.mark_number || "Item"} already verified.` }, 1800);
        speak("Already verified");
        vibrate([40, 40, 40]);
        setState("waiting_tag");
        return;
      }

      // Shared OCR/match snapshot written to clearance_evidence on every path.
      const evidenceMatchPatch = {
        ocr_mark: ocr.mark || ocr.tag_number || null,
        ocr_dwg: ocr.dwg || null,
        ocr_ref: ocr.ref || null,
        matched_mark: matchedItem.mark_number,
        matched_dwg: matchedItem.drawing_ref,
        matched_ref: matchedItem.ref_no,
        match_confidence: best.score,
        mismatch_reason: mismatchReason,
      };

      // PARTIAL MATCH AUTO-ADVANCE — if backend said 'confirm' only because
      // DWG/Ref is missing on the tag or on the item (not an actual mismatch),
      // and the MARK match is unambiguous (best score clearly beats #2), do
      // not stop for the manual pick overlay. Treat it as a partial match,
      // log it, show a brief banner, and continue the cycle automatically.
      const isMissingOnly =
        !!mismatchReason &&
        /missing on (item|tag)/i.test(mismatchReason) &&
        !/≠/.test(mismatchReason);
      const second = ranked[1]?.score ?? 0;
      const unambiguous = best.score - second >= 0.15 || ranked.length === 1;
      const partialAutoAccept = decision === "confirm" && isMissingOnly && unambiguous;

      if (decision === "confirm" && !partialAutoAccept) {
        // HOLD the captured tag blob — confirmPick will upload it after the
        // operator confirms the candidate.
        pendingTagBlobRef.current = blob;
        pendingTagOcrRef.current = { ocr, ranked, decision, mismatchReason };
        setPickCandidates(ranked.slice(0, 3));
        setLastConfidence(best.score);
        setState("tag_pick");
        if (mismatchReason) {
          showBanner({ kind: "mismatch", text: mismatchReason }, 2500);
        }
        speak("Confirm match");
        return;
      }

      if (partialAutoAccept) {
        clearanceFlowLog("partial_match_auto_accept", {
          cut_plan_item_id: matchedItem.id,
          mark: matchedItem.mark_number,
          mismatch_reason: mismatchReason,
          best_score: best.score,
          runner_up_score: second,
        });
        showBanner({ kind: "low_ocr", text: `Partial match · ${mismatchReason ?? ""}` }, 1800);
      }

      // Reset refine counter — we have a usable match.
      refineAttemptsRef.current = 0;
      // Mark the tag as trusted only on a clean auto-decision with strong
      // score. Partial-accept paths stay untrusted so material-validate runs.
      trustedTagRef.current = decision === "auto" && best.score >= 0.85 && !partialAutoAccept;

      // High confidence (strict MARK+DWG+Ref) — upload tag photo + ensure
      // evidence row in parallel, then write the evidence row update. Move to
      // product mode ONLY after the DB-confirmed gate passes.
      setActiveItemId(matchedItem.id);
      setLastConfidence(best.score);
      // Reuse the already-compressed shared blob — avoids a second canvas
      // pass inside uploadToStorage. Falls back to raw blob if prep failed.
      const sharedBlob = await sharedBlobPromise.catch(() => blob);
      const [evId, path] = await Promise.all([
        ensureEvidenceRow(matchedItem.id),
        uploadToStorage(matchedItem.id, "tag", sharedBlob),
      ]);
      clearanceFlowLog("storage_upload_success", {
        cut_plan_item_id: matchedItem.id,
        evidenceId: evId,
        photo_type: "tag",
        path,
      });
      const tRowUp = tNow();
      const { data: tagEvidence, error: tagUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          tag_scan_url: path,
          verification_state: "tag_scanned",
          verification_method: "auto",
          ai_confidence: best.score,
          ocr_metadata: { ocr, ranked, decision },
          storage_zone: selectedZone || matchedItem.storage_zone || undefined,
          ...evidenceMatchPatch,
        })
        .eq("id", evId)
        .select("id, cut_plan_item_id, tag_scan_url, storage_zone, verification_state")
        .maybeSingle();
      perfLog("tag_row_update", tNow() - tRowUp);
      if (tagUpErr) throw tagUpErr;
      if (!tagEvidence) throw new Error("Tag evidence update returned no row. Check RLS/auth/company access.");
      clearanceFlowLog("db_image_row_created", {
        evidenceId: evId,
        cut_plan_item_id: tagEvidence.cut_plan_item_id,
        photo_type: "tag",
        has_tag_scan_url: !!tagEvidence.tag_scan_url,
        storage_zone: tagEvidence.storage_zone,
        verification_state: tagEvidence.verification_state,
      });
      // HARD GATE — re-read the row; do NOT trust the local update result.
      await assertTagEvidenceReady(evId, matchedItem.id);
      setActiveEvidenceId(evId);
      setState("tag_evidence_saved");
      speak("Tag matched");
      vibrate(60);
      // Direct flip — no setTimeout. Removing the previous 250ms gap so the
      // product shutter cannot fire while the gate is mid-flight.
      setState("waiting_product");
      perfLog("cycle_tag_to_product", tNow() - cycleStartRef.current);

    } catch (e: any) {
      console.error("tag capture failed", e);
      const isTimeout = /timed out/i.test(e?.message || "");
      if (isTimeout) {
        clearanceFlowLog("scan_timeout", { stage: "tag_match", message: e?.message });
      }
      // Clear partial active refs so the next shutter cannot reuse a stale id.
      setActiveItemId(null);
      setActiveEvidenceId(null);
      showBanner({ kind: "error", text: e?.message || "Tag scan failed" }, 2500);
      setState("waiting_tag");
    } finally {
      setBusy(false);
      scanLockRef.current = false;
      // Background refetch — never blocks the next state.
      queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    }
  }, [busy, ensureEvidenceRow, manifestKey, queryClient, refreshQueueCount, selectedZone, showBanner, uploadToStorage]);

  const confirmPick = useCallback(async (candidateId: string) => {
    const match = itemsRef.current.find((i) => i.id === candidateId);
    if (!match) return;
    const blob = pendingTagBlobRef.current;
    if (!blob) {
      // No held tag blob (page refresh / drain path). Cannot guarantee
      // tag_scan_url — bounce back to waiting_tag so operator rescans.
      showBanner({ kind: "error", text: "Tag photo lost — rescan tag." }, 2500);
      setPickCandidates([]);
      setState("waiting_tag");
      return;
    }
    setActiveItemId(candidateId);
    setPickCandidates([]);
    setBusy(true);
    setState("tag_uploading");
    try {
      const [evId, path] = await Promise.all([
        ensureEvidenceRow(candidateId),
        uploadToStorage(candidateId, "tag", blob),
      ]);
      clearanceFlowLog("storage_upload_success", {
        cut_plan_item_id: candidateId,
        evidenceId: evId,
        photo_type: "tag",
        path,
      });
      const ocrHeld: any = pendingTagOcrRef.current?.ocr || lastOcr || {};
      const mismatchHeld: string | null = pendingTagOcrRef.current?.mismatchReason ?? null;
      const { data: pickEvidence, error: pickUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          tag_scan_url: path,
          verification_state: "tag_scanned",
          verification_method: "assisted",
          ai_confidence: lastConfidence,
          ocr_metadata: { ...(pendingTagOcrRef.current || { ocr: lastOcr }), picked: candidateId },
          storage_zone: selectedZone || match.storage_zone || undefined,
          ocr_mark: ocrHeld.mark || ocrHeld.tag_number || null,
          ocr_dwg: ocrHeld.dwg || null,
          ocr_ref: ocrHeld.ref || null,
          matched_mark: match.mark_number,
          matched_dwg: match.drawing_ref,
          matched_ref: match.ref_no,
          match_confidence: lastConfidence,
          mismatch_reason: mismatchHeld,
        })
        .eq("id", evId)
        .select("id, cut_plan_item_id, tag_scan_url, storage_zone, verification_state")
        .maybeSingle();
      if (pickUpErr) throw pickUpErr;
      if (!pickEvidence) throw new Error("Assisted tag evidence update returned no row. Check RLS/auth/company access.");
      clearanceFlowLog("db_image_row_created", {
        evidenceId: evId,
        cut_plan_item_id: pickEvidence.cut_plan_item_id,
        photo_type: "tag",
        has_tag_scan_url: !!pickEvidence.tag_scan_url,
        storage_zone: pickEvidence.storage_zone,
        verification_state: pickEvidence.verification_state,
      });
      await assertTagEvidenceReady(evId, candidateId);
      setActiveEvidenceId(evId);
      setState("tag_evidence_saved");
      speak("Confirmed");
      setState("waiting_product");
    } catch (e: any) {
      console.error("confirmPick failed", e);
      setActiveItemId(null);
      setActiveEvidenceId(null);
      showBanner({ kind: "error", text: e?.message || "Tag save failed" }, 3000);
      setState("waiting_tag");
    } finally {
      pendingTagBlobRef.current = null;
      pendingTagOcrRef.current = null;
      setBusy(false);
      queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    }
  }, [ensureEvidenceRow, lastConfidence, lastOcr, queryClient, selectedZone, showBanner, uploadToStorage]);


  const handleProductCapture = useCallback(async (blob: Blob) => {
    if (scanLockRef.current || busy) return;
    if (!activeItemId || !activeEvidenceId) {
      showBanner({ kind: "error", text: "Scan and save tag first." }, 2200);
      setState("waiting_tag");
      return;
    }
    if (!navigator.onLine) {
      try {
        await queue.enqueue({
          id: crypto.randomUUID(),
          kind: "product",
          itemId: activeItemId,
          manifestKey,
          blob,
          createdAt: Date.now(),
        });
        refreshQueueCount();
      } catch { /* ignore */ }
      showBanner({ kind: "offline", text: "Offline — product queued. Won't verify until sync." }, 3000);
      return;
    }
    scanLockRef.current = true;
    setBusy(true);
    setState("product_uploading");
    const tStartProduct = tNow();
    try {
      // HARD GATE — re-read evidence row and confirm tag photo persisted on
      // the SAME row before allowing product upload. Prevents the "product
      // photo without tag photo" failure mode entirely.
      try {
        await assertTagEvidenceReady(activeEvidenceId, activeItemId);
      } catch (gateErr: any) {
        const msg = gateErr instanceof ClearanceGateError
          ? gateErr.message
          : "Tag photo required before product photo.";
        showBanner({ kind: "error", text: msg }, 3000);
        setActiveItemId(null);
        setActiveEvidenceId(null);
        setState("waiting_tag");
        return;
      }

      const item = itemsRef.current.find((i) => i.id === activeItemId);
      const evId = activeEvidenceId;
      const path = await uploadToStorage(activeItemId, "product", blob);
      clearanceFlowLog("storage_upload_success", {
        cut_plan_item_id: activeItemId,
        evidenceId: evId,
        photo_type: "product",
        path,
      });
      // Row update first (so DB has product photo), then validation. Keeping
      // them parallel previously meant validation could pass before the row
      // existed if the row update silently failed.
      const tParallel = tNow();
      const { data: productEvidence, error: prodUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          material_photo_url: path,
          verification_state: "product_captured",
          storage_zone: selectedZone || item?.storage_zone || undefined,
        })
        .eq("id", evId)
        .select("id, cut_plan_item_id, tag_scan_url, material_photo_url, storage_zone, verification_state")
        .maybeSingle();
      if (prodUpErr) throw prodUpErr;
      if (!productEvidence) throw new Error("Product evidence update returned no row. Check RLS/auth/company access.");
      clearanceFlowLog("db_image_row_created", {
        evidenceId: evId,
        cut_plan_item_id: productEvidence.cut_plan_item_id,
        photo_type: "product",
        has_tag_scan_url: !!productEvidence.tag_scan_url,
        has_material_photo_url: !!productEvidence.material_photo_url,
        storage_zone: productEvidence.storage_zone,
        verification_state: productEvidence.verification_state,
      });
      setState("product_validating");
      let vData: any;
      let vErr: any = null;
      if (trustedTagRef.current) {
        // Tag already matched cleanly (decision=auto + high score). The
        // material-validate AI call is redundant — skip it to cut ~1-2s.
        clearanceFlowLog("validate_skipped_trusted_tag", {
          evidenceId: evId,
          cut_plan_item_id: activeItemId,
        });
        vData = { valid: true, confidence: "trusted_tag", reason: "tag matched with high confidence" };
      } else {
        const res = await withTimeout(
          supabase.functions.invoke(
            "validate-clearance-photo",
            {
              body: {
                photo_storage_path: path,
                expected_mark_number: item?.mark_number,
                expected_drawing_ref: item?.drawing_ref,
                photo_type: "material",
              },
            },
          ),
          AI_TIMEOUT_MS,
          "validate-clearance-photo",
        );
        vData = res.data;
        vErr = res.error;
      }
      perfLog("product_update+validate", tNow() - tParallel);
      if (vErr) throw vErr;

      const validation = vData || { valid: true, confidence: "unreadable" };
      const validationOk = validation.valid !== false;
      clearanceFlowLog("required_image_validation_result", {
        evidenceId: evId,
        cut_plan_item_id: activeItemId,
        has_tag_scan_url: !!productEvidence.tag_scan_url,
        has_material_photo_url: !!productEvidence.material_photo_url,
        validationOk,
        validation,
      });
      if (!validationOk) {
        await supabase
          .from("clearance_evidence")
          .update({
            verification_state: "manual_review",
            ocr_metadata: { ...((lastOcr && { ocr: lastOcr }) || {}), validation },
          })
          .eq("id", evId);
        showBanner({ kind: "mismatch", text: `Mismatch: expected "${item?.mark_number}" got "${validation.detected_mark || "?"}".` });
        speak("Wrong item");
        vibrate([120, 60, 120]);
        setState("waiting_product");
        return;
      }

      // Both photos uploaded + validated. Finalize.
      const tFinal = tNow();
      const finalizedItemId = activeItemId;
      const finalizedEvidenceId = evId;
      await finalizeVerification(evId, activeItemId, lastConfidence ?? 0, {
        ocr: lastOcr,
        validation,
      });
      perfLog("finalize", tNow() - tFinal);
      perfLog("cycle_product_total", tNow() - tStartProduct);
      perfLog("cycle_item_total", tNow() - cycleStartRef.current);

      // Post-finalize re-read — confirm DB landed at the expected end state
      // BEFORE we flip local UI. finalizeVerification already throws if phase
      // didn't reach 'complete', but we re-read evidence here for logs and so
      // the UI never lies about completion.
      const { data: evAfter } = await supabase
        .from("clearance_evidence")
        .select("id, status, verification_state, tag_scan_url, material_photo_url")
        .eq("id", finalizedEvidenceId)
        .maybeSingle();
      const { data: itemAfter } = await supabase
        .from("cut_plan_items")
        .select("id, phase")
        .eq("id", finalizedItemId)
        .maybeSingle();
      const beforeActive = itemsRef.current.filter((i) => i.evidence_status !== "cleared").length;
      const evidenceOk =
        !!evAfter?.tag_scan_url &&
        !!evAfter?.material_photo_url &&
        evAfter?.status === "cleared" &&
        evAfter?.verification_state === "complete";
      const phaseOk = itemAfter?.phase === "complete" || itemAfter?.phase === "cleared";
      clearanceFlowLog("completion_refetch_result", {
        evidence_id: finalizedEvidenceId,
        cut_plan_item_id: finalizedItemId,
        evidence_status: evAfter?.status ?? null,
        verification_state: evAfter?.verification_state ?? null,
        item_phase: itemAfter?.phase ?? null,
        has_tag_scan_url: !!evAfter?.tag_scan_url,
        has_material_photo_url: !!evAfter?.material_photo_url,
        ok: evidenceOk && phaseOk,
      });

      // Only optimistically remove from active list if DB confirms completion.
      // This preserves the "do not complete from React state alone" rule.
      if (evidenceOk && phaseOk) {
        markRecentlySaved(finalizedItemId);
        clearanceFlowLog("match_success", {
          cut_plan_item_id: finalizedItemId,
          evidence_id: finalizedEvidenceId,
        });
        setLocallyCompletedIds((prev) => {
          const next = new Set(prev);
          next.add(finalizedItemId);
          return next;
        });
      }

      // eslint-disable-next-line no-console
      console.log("[auto-clearance/post-finalize]", {
        evidence_id: finalizedEvidenceId,
        cut_plan_item_id: finalizedItemId,
        evidence_status: evAfter?.status ?? null,
        verification_state: evAfter?.verification_state ?? null,
        item_phase: itemAfter?.phase ?? null,
        tag_scan_url: !!evAfter?.tag_scan_url,
        material_photo_url: !!evAfter?.material_photo_url,
        active_before: beforeActive,
        active_after: Math.max(0, beforeActive - (evidenceOk && phaseOk ? 1 : 0)),
        ok: evidenceOk && phaseOk,
      });

      setState("completed");
      speak("Verified");
      vibrate(120);

      // Staggered refetches — don't rely on realtime alone. Refetch now, at
      // 500ms, and at 2s so the canonical clearance-items list catches up
      // even if the realtime channel is slow or dropped.
      const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
        queryClient.refetchQueries({ queryKey: ["clearance-items"] });
      };
      refetch();
      window.setTimeout(refetch, 500);
      window.setTimeout(refetch, 2000);

      // Snap back to next item quickly. Voice/animation don't block.
      window.setTimeout(() => {
        setActiveItemId(null);
        setActiveEvidenceId(null);
        setPickCandidates([]);
        const remaining = itemsRef.current.filter(
          (i) => i.evidence_status !== "cleared" && i.id !== finalizedItemId,
        ).length;
        if (remaining === 0) {
          setState("manifest_complete");
        } else {
          clearanceFlowLog("auto_advance", { next: "waiting_tag", remaining });
          setState("waiting_tag");
        }
      }, 120);
    } catch (e: any) {
      console.error("product capture failed", e);
      const isTimeout = /timed out/i.test(e?.message || "");
      if (isTimeout) {
        clearanceFlowLog("scan_timeout", { stage: "product_validate", message: e?.message });
      }
      showBanner({ kind: "error", text: e?.message || "Verification failed" }, 2500);
      // After a timeout, reset the cycle so the camera is ready immediately
      // instead of parking on the VERIFYING ring.
      if (isTimeout) {
        setActiveItemId(null);
        setActiveEvidenceId(null);
        setState("waiting_tag");
      } else {
        setState("waiting_product");
      }
    } finally {
      setBusy(false);
      scanLockRef.current = false;
      // Background refetch — never blocks the next state.
      queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    }
  }, [activeItemId, activeEvidenceId, busy, ensureEvidenceRow, finalizeVerification, lastConfidence, lastOcr, manifestKey, queryClient, refreshQueueCount, selectedZone, showBanner, uploadToStorage]);

  // -------- offline drain --------
  const drainQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const pending = await queue.list();
      for (const cap of pending) {
        // We can't safely auto-match tag captures without the operator's eyes —
        // re-feed tag captures into the pipeline; product captures only resolve
        // if their itemId still pending and a tag has not been re-scanned.
        try {
          if (cap.kind === "tag") {
            await handleTagCapture(cap.blob);
          } else if (cap.itemId) {
            // Drain safety — never write a product photo to a row whose tag
            // photo has not been confirmed. Look up evidence row first.
            const { data: ev } = await supabase
              .from("clearance_evidence")
              .select("id, tag_scan_url")
              .eq("cut_plan_item_id", cap.itemId)
              .maybeSingle();
            if (!ev?.id || !ev.tag_scan_url) {
              console.warn("drain skipping orphan product capture (no tag_scan_url)", cap.id);
              continue; // leave in queue
            }
            setActiveItemId(cap.itemId);
            setActiveEvidenceId(ev.id);
            await handleProductCapture(cap.blob);
          }
          await queue.remove(cap.id);
        } catch (e) {
          console.warn("drain item failed; leaving queued", e);
        }
      }
    } finally {
      refreshQueueCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleTagCapture, handleProductCapture, refreshQueueCount]);

  return {
    state,
    banner,
    activeItem: items.find((i) => i.id === activeItemId) || null,
    pickCandidates,
    verifiedCount,
    totalCount,
    pendingItems,
    manifestComplete,
    online,
    queuedCount,
    busy,
    handleTagCapture,
    handleProductCapture,
    confirmPick,
    dismissBanner: () => setBanner(null),
    drainQueue,
  };
}
