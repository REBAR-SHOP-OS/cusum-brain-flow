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
 * Build an OCR-optimized copy of the captured blob: max ~1200px, JPEG 0.8.
 * Used for the AI call so the OCR roundtrip doesn't wait on the full archive
 * upload. Falls back to the original blob if anything goes wrong.
 */
async function buildOcrBlob(src: Blob): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return src;
    const bmp = await createImageBitmap(src);
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return await c.convertToBlob({ type: "image/jpeg", quality: 0.8 });
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
      .filter((i) => i.evidence_status !== "cleared")
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
  }, [items, selectedZone]);

  useEffect(() => {
    if (manifestComplete && state !== "manifest_complete") {
      setState("manifest_complete");
      speak("Manifest complete");
      vibrate([80, 60, 80]);
    }
  }, [manifestComplete, state]);

  const showBanner = useCallback((b: Banner, ms = 2200) => {
    setBanner(b);
    if (b && b.kind !== "mismatch") {
      window.setTimeout(() => {
        setBanner((cur) => (cur === b ? null : cur));
      }, ms);
    }
  }, []);

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
    const compressed = await compressImage(
      new File([blob], `${kind}-${Date.now()}.jpg`, { type: "image/jpeg" })
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
    if (existingLocal?.evidence_id) return existingLocal.evidence_id;
    // Authoritative check against DB before inserting.
    const { data: found, error: findErr } = await supabase
      .from("clearance_evidence")
      .select("id")
      .eq("cut_plan_item_id", itemId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (found?.id) return found.id as string;
    const { data, error } = await supabase
      .from("clearance_evidence")
      .insert({
        cut_plan_item_id: itemId,
        status: "pending",
        verification_method: "auto",
        verification_state: "pending",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }, []);

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

    const { error: upErr } = await supabase
      .from("clearance_evidence")
      .update({
        status: "cleared",
        verification_state: "complete",
        verification_method: "auto",
        ai_confidence: confidence,
        ocr_metadata: ocrMeta,
        verified_by: userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", evidenceId);
    if (upErr) throw upErr;

    // Re-read DB to confirm trigger chain landed at 'complete'.
    const { data: postItem, error: readErr } = await supabase
      .from("cut_plan_items")
      .select("phase")
      .eq("id", itemId)
      .maybeSingle();
    if (readErr) throw readErr;
    let finalPhase = postItem?.phase ?? null;

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

      // Run OCR/match in parallel with storage upload. OCR uses a downscaled
      // copy so the AI roundtrip isn't blocked on the full-size upload.
      const tOcrPrep = tNow();
      const ocrBlobPromise = buildOcrBlob(blob);
      setState("ocr_running");
      const ocrPromise = ocrBlobPromise
        .then(blobToBase64)
        .then(async (imageBase64) => {
          perfLog("ocr_prep", tNow() - tOcrPrep);
          const tOcr = tNow();
          const r = await supabase.functions.invoke("match-tag-photo", {
            body: { imageBase64, candidates },
          });
          perfLog("ocr+match", tNow() - tOcr);
          return r;
        });

      // We need the matched item before we know which itemId to upload under,
      // so the tag upload starts AFTER OCR returns. (Upload path is keyed by
      // matched itemId — uploading speculatively would create orphaned files.)
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
        showBanner({ kind: "low_ocr", text: "Tag unreadable — please rescan." }, 2500);
        setState("waiting_tag");
        return;
      }
      const best = ranked[0];
      const matchedItem = itemsRef.current.find((i) => i.id === best.id);
      if (!matchedItem) {
        showBanner({ kind: "mismatch", text: "Tag does not match this manifest." });
        setState("waiting_tag");
        return;
      }
      // Zone gate — if a zone is selected and the matched item is bound to a
      // different zone, never auto-match. Operator must rescan or change zone.
      const activeZone = (selectedZone || "").trim();
      if (activeZone && matchedItem.storage_zone && matchedItem.storage_zone !== activeZone) {
        showBanner({ kind: "mismatch", text: "Tag belongs to a different zone." }, 3000);
        speak("Wrong zone");
        vibrate([120, 60, 120]);
        setState("waiting_tag");
        return;
      }
      if (matchedItem.evidence_status === "cleared") {
        showBanner({ kind: "duplicate", text: `${matchedItem.mark_number || "Item"} already verified.` });
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

      if (decision === "confirm") {
        // HOLD the captured tag blob — confirmPick will upload it after the
        // operator confirms the candidate. Previously this branch dropped the
        // blob entirely, leaving evidence rows without a tag_scan_url.
        pendingTagBlobRef.current = blob;
        pendingTagOcrRef.current = { ocr, ranked, decision, mismatchReason };
        setPickCandidates(ranked.slice(0, 3));
        setLastConfidence(best.score);
        setState("tag_pick");
        if (mismatchReason) {
          showBanner({ kind: "mismatch", text: mismatchReason }, 4000);
        }
        speak("Confirm match");
        return;
      }

      // High confidence (strict MARK+DWG+Ref) — upload tag photo + ensure
      // evidence row in parallel, then write the evidence row update. Move to
      // product mode ONLY after the DB-confirmed gate passes.
      setActiveItemId(matchedItem.id);
      setLastConfidence(best.score);
      const [evId, path] = await Promise.all([
        ensureEvidenceRow(matchedItem.id),
        uploadToStorage(matchedItem.id, "tag", blob),
      ]);
      const tRowUp = tNow();
      const { error: tagUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          tag_scan_url: path,
          verification_state: "tag_scanned",
          verification_method: "auto",
          ai_confidence: best.score,
          ocr_metadata: { ocr, ranked, decision },
          ...evidenceMatchPatch,
        })
        .eq("id", evId);
      perfLog("tag_row_update", tNow() - tRowUp);
      if (tagUpErr) throw tagUpErr;
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
      // Clear partial active refs so the next shutter cannot reuse a stale id.
      setActiveItemId(null);
      setActiveEvidenceId(null);
      showBanner({ kind: "error", text: e?.message || "Tag scan failed" }, 3000);
      setState("waiting_tag");
    } finally {
      setBusy(false);
      scanLockRef.current = false;
      // Background refetch — never blocks the next state.
      queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    }
  }, [busy, ensureEvidenceRow, manifestKey, queryClient, refreshQueueCount, showBanner, uploadToStorage]);

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
      const ocrHeld: any = pendingTagOcrRef.current?.ocr || lastOcr || {};
      const mismatchHeld: string | null = pendingTagOcrRef.current?.mismatchReason ?? null;
      const { error: pickUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          tag_scan_url: path,
          verification_state: "tag_scanned",
          verification_method: "assisted",
          ai_confidence: lastConfidence,
          ocr_metadata: { ...(pendingTagOcrRef.current || { ocr: lastOcr }), picked: candidateId },
          ocr_mark: ocrHeld.mark || ocrHeld.tag_number || null,
          ocr_dwg: ocrHeld.dwg || null,
          ocr_ref: ocrHeld.ref || null,
          matched_mark: match.mark_number,
          matched_dwg: match.drawing_ref,
          matched_ref: match.ref_no,
          match_confidence: lastConfidence,
          mismatch_reason: mismatchHeld,
        })
        .eq("id", evId);
      if (pickUpErr) throw pickUpErr;
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
  }, [ensureEvidenceRow, lastConfidence, lastOcr, queryClient, showBanner, uploadToStorage]);


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
      // Row update first (so DB has product photo), then validation. Keeping
      // them parallel previously meant validation could pass before the row
      // existed if the row update silently failed.
      const tParallel = tNow();
      const { error: prodUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          material_photo_url: path,
          verification_state: "product_captured",
        })
        .eq("id", evId);
      if (prodUpErr) throw prodUpErr;
      setState("product_validating");
      const { data: vData, error: vErr } = await supabase.functions.invoke(
        "validate-clearance-photo",
        {
          body: {
            photo_storage_path: path,
            expected_mark_number: item?.mark_number,
            expected_drawing_ref: item?.drawing_ref,
            photo_type: "material",
          },
        },
      );
      perfLog("product_update+validate", tNow() - tParallel);
      if (vErr) throw vErr;

      const validation = vData || { valid: true, confidence: "unreadable" };
      const validationOk = validation.valid !== false;
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
      await finalizeVerification(evId, activeItemId, lastConfidence ?? 0, {
        ocr: lastOcr,
        validation,
      });
      perfLog("finalize", tNow() - tFinal);
      perfLog("cycle_product_total", tNow() - tStartProduct);
      perfLog("cycle_item_total", tNow() - cycleStartRef.current);
      setState("completed");
      speak("Verified");
      vibrate(120);
      // Snap back to next item quickly. Voice/animation don't block.
      window.setTimeout(() => {
        setActiveItemId(null);
        setActiveEvidenceId(null);
        setPickCandidates([]);
        setState("waiting_tag");
      }, 450);
    } catch (e: any) {
      console.error("product capture failed", e);
      showBanner({ kind: "error", text: e?.message || "Verification failed" }, 3000);
      setState("waiting_product");
    } finally {
      setBusy(false);
      scanLockRef.current = false;
      // Background refetch — never blocks the next state.
      queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    }
  }, [activeItemId, activeEvidenceId, busy, ensureEvidenceRow, finalizeVerification, lastConfidence, lastOcr, manifestKey, queryClient, refreshQueueCount, showBanner, uploadToStorage]);

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
