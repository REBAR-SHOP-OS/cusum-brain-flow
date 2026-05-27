import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/imageCompressor";
import type { ClearanceItem } from "@/hooks/useClearanceData";
import { speak, vibrate } from "@/lib/voiceFeedback";
import * as queue from "@/lib/autoClearanceQueue";

export type AutoState =
  | "waiting_tag"
  | "tag_matching"
  | "tag_matched"
  | "tag_pick"           // medium confidence — show top 3
  | "waiting_product"
  | "auto_verifying"
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

const HIGH_CONFIDENCE = 0.85;

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

export function useAutoClearance({
  items,
  manifestKey,
  userId,
}: {
  items: ClearanceItem[];
  manifestKey: string;
  userId?: string;
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
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

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
    () => items.filter((i) => i.evidence_status !== "cleared"),
    [items]
  );
  const verifiedCount = items.length - pendingItems.length;
  const totalCount = items.length;
  const manifestComplete = totalCount > 0 && pendingItems.length === 0;

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

  const uploadToStorage = useCallback(async (
    itemId: string,
    kind: "tag" | "product",
    blob: Blob,
  ): Promise<string> => {
    const compressed = await compressImage(
      new File([blob], `${kind}-${Date.now()}.jpg`, { type: "image/jpeg" })
    );
    const ext = compressed.name.split(".").pop() || "jpg";
    const path = `${itemId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("clearance-photos")
      .upload(path, compressed, { upsert: true });
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
  // AND validate-clearance-photo returned valid.
  const finalizeVerification = useCallback(async (
    evidenceId: string,
    itemId: string,
    confidence: number,
    ocrMeta: any,
  ) => {
    // Re-read this specific evidence row and confirm both photos are attached.
    const { data: ev, error: readErr } = await supabase
      .from("clearance_evidence")
      .select("id, tag_scan_url, material_photo_url")
      .eq("id", evidenceId)
      .maybeSingle();
    if (readErr || !ev) throw readErr || new Error("Evidence row missing");
    console.log("[auto-clearance] finalize read", { evidenceId, itemId, tag: ev.tag_scan_url, product: ev.material_photo_url });
    if (!ev.tag_scan_url || !ev.material_photo_url) {
      throw new Error("Both tag and product photos required before auto verify");
    }
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
      .eq("id", ev.id);
    if (upErr) throw upErr;
    // The auto_advance trigger flips cut_plan_items.phase to 'complete'.
  }, [userId]);

  // -------- main captures --------

  const handleTagCapture = useCallback(async (blob: Blob) => {
    if (busy) return;
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
      return;
    }
    setBusy(true);
    setState("tag_matching");
    try {
      const candidates = itemsRef.current
        .filter((i) => i.evidence_status !== "cleared")
        .map((i) => ({
          id: i.id,
          mark_number: i.mark_number,
          bar_code: i.bar_code,
          cut_length_mm: i.cut_length_mm,
          total_pieces: i.total_pieces,
          asa_shape_code: i.asa_shape_code,
        }));
      if (candidates.length === 0) {
        setState("manifest_complete");
        return;
      }
      const imageBase64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("match-tag-photo", {
        body: { imageBase64, candidates },
      });
      if (error) throw error;
      const ocr = data?.ocr || {};
      const ranked: RankedMatch[] = data?.ranked || [];
      const decision: "auto" | "confirm" | "none" = data?.decision || "none";
      setLastOcr(ocr);

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
      if (matchedItem.evidence_status === "cleared") {
        showBanner({ kind: "duplicate", text: `${matchedItem.mark_number || "Item"} already verified.` });
        speak("Already verified");
        vibrate([40, 40, 40]);
        setState("waiting_tag");
        return;
      }

      if (decision === "confirm") {
        setPickCandidates(ranked.slice(0, 3));
        setLastConfidence(best.score);
        setState("tag_pick");
        speak("Confirm match");
        return;
      }

      // High confidence → upload tag photo, write evidence, advance to product.
      setActiveItemId(matchedItem.id);
      setLastConfidence(best.score);
      const evId = await ensureEvidenceRow(matchedItem.id);
      const path = await uploadToStorage(matchedItem.id, "tag", blob);
      console.log("[auto-clearance] tag uploaded", { itemId: matchedItem.id, evId, path });
      const { error: tagUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          tag_scan_url: path,
          verification_state: "tag_scanned",
          verification_method: "auto",
          ai_confidence: best.score,
          ocr_metadata: { ocr, ranked, decision },
        })
        .eq("id", evId);
      if (tagUpErr) throw tagUpErr;
      setActiveEvidenceId(evId);
      console.log("[auto-clearance] tag evidence row updated", { evId });
      setState("tag_matched");
      speak("Tag matched");
      vibrate(60);
      window.setTimeout(() => setState("waiting_product"), 600);
    } catch (e: any) {
      console.error("tag capture failed", e);
      showBanner({ kind: "error", text: e?.message || "Tag scan failed" }, 3000);
      setState("waiting_tag");
    } finally {
      setBusy(false);
      queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    }
  }, [busy, ensureEvidenceRow, manifestKey, queryClient, refreshQueueCount, showBanner, uploadToStorage]);

  const confirmPick = useCallback(async (candidateId: string) => {
    const match = itemsRef.current.find((i) => i.id === candidateId);
    if (!match) return;
    setActiveItemId(candidateId);
    setPickCandidates([]);
    setState("tag_matched");
    // We already uploaded nothing yet for pick path — operator will rescan tag
    // attached to this item by capturing PRODUCT photo next. Pre-create row.
    try {
      const evId = await ensureEvidenceRow(candidateId);
      const { error: pickUpErr } = await supabase
        .from("clearance_evidence")
        .update({
          verification_state: "tag_scanned",
          verification_method: "assisted",
          ai_confidence: lastConfidence,
          ocr_metadata: { ocr: lastOcr, picked: candidateId },
        })
        .eq("id", evId);
      if (pickUpErr) throw pickUpErr;
      setActiveEvidenceId(evId);
    } catch (e) {
      console.error("confirmPick row create failed", e);
    }
    speak("Confirmed");
    window.setTimeout(() => setState("waiting_product"), 400);
  }, [ensureEvidenceRow, lastConfidence, lastOcr]);

  const handleProductCapture = useCallback(async (blob: Blob) => {
    if (busy) return;
    if (!activeItemId) {
      showBanner({ kind: "error", text: "Scan a tag first." }, 2000);
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
    setBusy(true);
    setState("auto_verifying");
    try {
      const item = itemsRef.current.find((i) => i.id === activeItemId);
      const evId = await ensureEvidenceRow(activeItemId);
      const path = await uploadToStorage(activeItemId, "product", blob);
      await supabase
        .from("clearance_evidence")
        .update({
          material_photo_url: path,
          verification_state: "product_captured",
        })
        .eq("id", evId);

      // Validate product photo against expected mark / drawing.
      const { data: vData, error: vErr } = await supabase.functions.invoke(
        "validate-clearance-photo",
        {
          body: {
            photo_storage_path: path,
            expected_mark_number: item?.mark_number,
            expected_drawing_ref: item?.drawing_ref,
            photo_type: "material",
          },
        }
      );
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
      await finalizeVerification(activeItemId, lastConfidence ?? 0, {
        ocr: lastOcr,
        validation,
      });
      setState("completed");
      speak("Verified");
      vibrate(120);
      window.setTimeout(() => {
        setActiveItemId(null);
        setPickCandidates([]);
        setState("waiting_tag");
      }, 1100);
    } catch (e: any) {
      console.error("product capture failed", e);
      showBanner({ kind: "error", text: e?.message || "Verification failed" }, 3000);
      setState("waiting_product");
    } finally {
      setBusy(false);
      queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
    }
  }, [activeItemId, busy, ensureEvidenceRow, finalizeVerification, lastConfidence, lastOcr, manifestKey, queryClient, refreshQueueCount, showBanner, uploadToStorage]);

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
            // Restore activeItemId temporarily to route product upload.
            setActiveItemId(cap.itemId);
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
