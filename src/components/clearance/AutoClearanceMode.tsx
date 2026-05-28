import { useState } from "react";
import { X, ShieldCheck, CheckCircle2, AlertTriangle, WifiOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AutoCameraStream } from "./AutoCameraStream";
import { useAutoClearance } from "@/hooks/useAutoClearance";
import { setVoiceEnabled, isVoiceEnabled } from "@/lib/voiceFeedback";
import type { ClearanceItem } from "@/hooks/useClearanceData";

interface AutoClearanceModeProps {
  items: ClearanceItem[];
  manifestLabel: string;
  manifestKey: string;
  userId?: string;
  onExit: () => void;
}

export function AutoClearanceMode({
  items,
  manifestLabel,
  manifestKey,
  userId,
  onExit,
}: AutoClearanceModeProps) {
  const {
    state,
    banner,
    activeItem,
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
    dismissBanner,
  } = useAutoClearance({ items, manifestKey, userId });

  const [voiceOn, setVoiceOn] = useState(isVoiceEnabled());
  const [showPanel, setShowPanel] = useState(false);

  // Stage drives which camera mode is active. PRODUCT mode is only reached
  // after the DB-confirmed tag gate passes (state === 'waiting_product').
  // tag_evidence_saved is a momentary stage just before waiting_product —
  // keep it on the TAG camera mode so the product shutter cannot fire early.
  const stage: "tag" | "product" =
    state === "waiting_product" ||
    state === "product_uploading" ||
    state === "product_validating"
      ? "product"
      : "tag";

  // Hard lock: product shutter only fires once tag photo is DB-confirmed.
  const productLocked = stage === "product" && state !== "waiting_product";

  const ringColor =
    state === "waiting_tag" ? "blue"
    : state === "tag_uploading" ? "blue"
    : state === "ocr_running" ? "blue"
    : state === "matching" ? "blue"
    : state === "tag_evidence_saved" ? "green"
    : state === "waiting_product" ? "amber"
    : state === "product_uploading" ? "amber"
    : state === "product_validating" ? "amber"
    : state === "completed" ? "green"
    : "none";

  const overlayLabel =
    state === "waiting_tag" ? "SCAN TAG"
    : state === "tag_uploading" ? "UPLOADING TAG…"
    : state === "ocr_running" ? "READING TAG…"
    : state === "matching" ? "MATCHING…"
    : state === "tag_evidence_saved" ? `MATCHED ${activeItem?.mark_number ?? ""}`
    : state === "tag_pick" ? "CONFIRM MATCH"
    : state === "waiting_product" ? `PHOTO BUNDLE ${activeItem?.mark_number ?? ""}`
    : state === "product_uploading" ? "UPLOADING PHOTO…"
    : state === "product_validating" ? "VERIFYING…"
    : state === "completed" ? "VERIFIED"
    : state === "manifest_complete" ? "MANIFEST COMPLETE"
    : "";

  const onCapture = (blob: Blob) => {
    if (stage === "tag") handleTagCapture(blob);
    else handleProductCapture(blob);
  };

  const pct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  const bannerStyles = banner && {
    duplicate: "bg-amber-500/95 text-black",
    mismatch: "bg-red-600/95 text-white",
    low_ocr: "bg-amber-500/95 text-black",
    offline: "bg-slate-700/95 text-white",
    error: "bg-red-600/95 text-white",
  }[banner.kind];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* TOP HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-b from-black/85 to-transparent">
        <div className="flex items-start justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="text-[9px] tracking-[0.18em] uppercase text-primary font-semibold">
              Manifest
            </p>
            <p className="text-sm font-bold uppercase tracking-wider truncate max-w-[60vw]">
              {manifestLabel}
            </p>
            <p className="text-[10px] mt-0.5 text-white/70">
              Target: <span className="font-bold text-white">{activeItem?.mark_number ?? (stage === "tag" ? "AUTO — scanning" : "—")}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              {!online && (
                <Badge className="gap-1.5 bg-slate-700 text-white border-0 text-[10px]">
                  <WifiOff className="w-3 h-3" /> OFFLINE
                </Badge>
              )}
              {queuedCount > 0 && (
                <Badge className="bg-amber-500/90 text-black border-0 text-[10px]">
                  {queuedCount} queued
                </Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 h-8 w-8"
                onClick={() => {
                  const next = !voiceOn;
                  setVoiceOn(next);
                  setVoiceEnabled(next);
                }}
                aria-label="Toggle voice feedback"
              >
                {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 h-8 w-8"
                onClick={onExit}
                aria-label="Exit Auto Mode"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="text-right tabular-nums">
              <p className="text-2xl font-black leading-none">
                {verifiedCount} / {totalCount}
              </p>
              <p className="text-[10px] text-white/70 tracking-wider uppercase">{pct}% verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* CAMERA */}
      <div className="absolute inset-0">
        <AutoCameraStream
          mode={stage}
          onCapture={onCapture}
          ringColor={ringColor as any}
          overlayLabel={overlayLabel}
          disabled={busy || manifestComplete || state === "tag_pick"}
        />
      </div>

      {/* COMPLETED FLASH */}
      {state === "completed" && (
        <div className="absolute inset-0 z-40 bg-emerald-500/40 backdrop-blur-[2px] pointer-events-none flex items-center justify-center animate-in fade-in duration-100">
          <CheckCircle2 className="w-40 h-40 text-white drop-shadow-2xl" />
        </div>
      )}

      {/* BUSY OVERLAY */}
      {(state === "auto_verifying" || state === "tag_matching") && (
        <div className="absolute inset-0 z-30 bg-black/40 pointer-events-none flex items-center justify-center">
          <div className="bg-black/80 rounded-2xl px-6 py-4 flex items-center gap-3 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-bold tracking-wider uppercase">
              {state === "auto_verifying" ? "Verifying" : "Reading tag"}
            </span>
          </div>
        </div>
      )}

      {/* PICK 3 OVERLAY */}
      {state === "tag_pick" && (
        <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center p-6 gap-4">
          <p className="text-white text-sm tracking-[0.18em] uppercase">Confirm match</p>
          <div className="w-full max-w-md flex flex-col gap-3">
            {pickCandidates.map((c) => {
              const it = items.find((i) => i.id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => confirmPick(c.id)}
                  className="w-full p-5 rounded-2xl bg-white text-black hover:bg-white/90 active:scale-[0.99] flex items-center justify-between text-left"
                >
                  <div>
                    <p className="text-2xl font-black">{c.mark_number || it?.bar_code}</p>
                    <p className="text-xs text-black/60 tracking-wider uppercase mt-0.5">
                      {it?.bar_code} · {it?.total_pieces} pcs · score {Math.round(c.score * 100)}%
                    </p>
                  </div>
                  <CheckCircle2 className="w-7 h-7" />
                </button>
              );
            })}
            <Button variant="ghost" className="text-white" onClick={() => window.location.reload()}>
              None of these — rescan
            </Button>
          </div>
        </div>
      )}

      {/* MANIFEST COMPLETE OVERLAY */}
      {manifestComplete && (
        <div className="absolute inset-0 z-40 bg-emerald-700/95 flex flex-col items-center justify-center gap-4 text-white p-6 text-center">
          <ShieldCheck className="w-20 h-20" />
          <p className="text-2xl font-black uppercase tracking-wider">Manifest Complete</p>
          <p className="text-sm opacity-80">{verifiedCount} / {totalCount} items verified.</p>
          <Button size="lg" onClick={onExit} className="mt-4 bg-white text-emerald-700 hover:bg-white/90">
            Back to Manifest
          </Button>
        </div>
      )}

      {/* BANNER */}
      {banner && (
        <button
          type="button"
          onClick={dismissBanner}
          className={`absolute left-0 right-0 top-20 mx-4 z-40 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl ${bannerStyles}`}
        >
          {banner.kind === "offline" ? <WifiOff className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-bold tracking-wider uppercase flex-1 text-left">
            {banner.text}
          </span>
        </button>
      )}

      {/* SIDE PANEL TOGGLE */}
      <button
        type="button"
        onClick={() => setShowPanel((v) => !v)}
        className="absolute right-4 bottom-1/2 translate-y-1/2 z-30 bg-black/70 backdrop-blur text-white text-[10px] tracking-wider uppercase px-2 py-3 rounded-l-xl"
      >
        {showPanel ? "Hide" : `${pendingItems.length} left`}
      </button>

      {showPanel && (
        <div className="absolute right-0 top-20 bottom-20 z-30 w-[min(320px,80vw)] bg-black/85 backdrop-blur border-l border-white/10 text-white">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {items.map((it) => {
                const cleared = it.evidence_status === "cleared";
                const active = it.id === activeItem?.id;
                return (
                  <div
                    key={it.id}
                    className={`rounded-lg px-3 py-2 border ${cleared ? "border-emerald-500/40 bg-emerald-500/10" : active ? "border-amber-400/60 bg-amber-400/10" : "border-white/10 bg-white/[0.03]"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{it.mark_number || it.bar_code}</span>
                      {cleared && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-white/60 tracking-wider uppercase">
                      {it.bar_code} · {it.total_pieces}pc
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
