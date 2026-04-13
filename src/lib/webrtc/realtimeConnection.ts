
/**
 * Shared WebRTC helpers for OpenAI Realtime connections.
 *
 * ICE server configuration:
 * - STUN servers are always included (Google + Cloudflare, free & reliable).
 * - TURN servers are injected dynamically from the backend (Metered API)
 *   at session start. No credentials are hardcoded in the frontend.
 *
 * SDP strategy: We use a bounded gather — wait briefly for preferred
 * candidates before sending the SDP, but never block longer than a
 * few seconds.
 */

/** Fallback STUN servers — always included */
const FALLBACK_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * Build the full ICE server list.
 * @param turnServers — dynamic TURN servers from the backend (Metered API).
 *   If empty/undefined, only STUN fallback is used.
 */
export function buildIceServers(turnServers?: RTCIceServer[]): RTCIceServer[] {
  const servers: RTCIceServer[] = [...FALLBACK_STUN];
  if (turnServers && turnServers.length > 0) {
    servers.push(...turnServers);
  }
  return servers;
}

/**
 * Create an RTCPeerConnection pre-configured with STUN + dynamic TURN.
 * Uses max-bundle to reduce ICE candidates and speed up connectivity.
 *
 * @param turnServers — dynamic TURN servers from the backend.
 * @param iceTransportPolicy — "all" (default) or "relay" (force TURN only).
 */
export function createRealtimePeerConnection(
  turnServers?: RTCIceServer[],
  iceTransportPolicy: RTCIceTransportPolicy = "all",
): RTCPeerConnection {
  const iceServers = buildIceServers(turnServers);
  return new RTCPeerConnection({
    iceServers,
    bundlePolicy: "max-bundle",
    iceCandidatePoolSize: 1,
    iceTransportPolicy,
  });
}

/**
 * Check if an SDP string contains at least one real ICE candidate line.
 */
export function hasUsableCandidates(sdp: string): boolean {
  const candidateLines = sdp.match(/^a=candidate:/gm);
  return !!candidateLines && candidateLines.length > 0;
}

/**
 * Check if an SDP contains at least one relay candidate.
 */
export function hasRelayCandidates(sdp: string): boolean {
  return /^a=candidate:.+typ relay/m.test(sdp);
}

/**
 * Check if an SDP contains at least one srflx or relay candidate.
 */
export function hasReflexiveOrRelayCandidates(sdp: string): boolean {
  return /^a=candidate:.+typ (relay|srflx)/m.test(sdp);
}

export interface WaitForUsableCandidatesOptions {
  timeoutMs?: number;
  preferRelay?: boolean;
  requireRelay?: boolean;
}

/**
 * Wait briefly for usable ICE candidates to appear in the local description.
 * Returns the SDP as soon as a relay/srflx candidate is found, or after
 * the timeout — whichever comes first.
 *
 * This prevents sending under-populated SDPs on mobile networks where
 * relay candidates take 1–3s to arrive after setLocalDescription.
 *
 * @param pc — the peer connection (must already have localDescription set)
 * @param timeoutMs — max time to wait (default 3s)
 * @returns the best available SDP string
 */
export function waitForUsableCandidatesBounded(
  pc: RTCPeerConnection,
  options: WaitForUsableCandidatesOptions | number = 3000
): Promise<string> {
  const { timeoutMs, preferRelay, requireRelay } =
    typeof options === "number"
      ? { timeoutMs: options, preferRelay: false, requireRelay: false }
      : {
          timeoutMs: options.timeoutMs ?? 3000,
          preferRelay: options.preferRelay ?? false,
          requireRelay: options.requireRelay ?? false,
        };

  const hasTargetCandidates = (sdp: string) => {
    if (requireRelay || preferRelay) return hasRelayCandidates(sdp);
    return hasReflexiveOrRelayCandidates(sdp);
  };

  const successLabel = requireRelay
    ? "relay candidate found"
    : preferRelay
      ? "preferred relay candidate found"
      : "usable srflx/relay candidate found";

  // If we already have the preferred candidate type, return immediately.
  const currentSdp = pc.localDescription?.sdp;
  if (currentSdp && hasTargetCandidates(currentSdp)) {
    return Promise.resolve(currentSdp);
  }

  return new Promise<string>((resolve) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      pc.removeEventListener("icecandidate", onCandidate);
      pc.removeEventListener("icegatheringstatechange", onGatherComplete);
      const sdp = pc.localDescription?.sdp;
      resolve(sdp || currentSdp || "");
    };

    const timer = setTimeout(() => {
      console.log("[WebRTC] Bounded gather timeout — sending SDP as-is");
      done();
    }, timeoutMs);

    const onCandidate = () => {
      const sdp = pc.localDescription?.sdp;
      if (sdp && hasTargetCandidates(sdp)) {
        console.log(`[WebRTC] Bounded gather — ${successLabel}, proceeding`);
        done();
      }
    };

    const onGatherComplete = () => {
      if (pc.iceGatheringState === "complete") {
        console.log("[WebRTC] Bounded gather — ICE gathering complete");
        done();
      }
    };

    pc.addEventListener("icecandidate", onCandidate);
    pc.addEventListener("icegatheringstatechange", onGatherComplete);
  });
}

/**
 * Wait for ICE gathering to complete (or timeout).
 * Returns the full local description with all candidates baked in.
 *
 * NOTE: For OpenAI Realtime, you typically do NOT need this — use
 * waitForUsableCandidatesBounded instead. This helper is kept for
 * other WebRTC flows that require gathered candidates in the SDP.
 *
 * @throws if no usable candidates are gathered within the timeout.
 */
export async function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 8000
): Promise<RTCSessionDescription> {
  if (pc.iceGatheringState === "complete" && pc.localDescription) {
    return pc.localDescription;
  }

  return new Promise<RTCSessionDescription>((resolve, reject) => {
    const timer = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      pc.removeEventListener("icecandidate", onCandidate);
      const desc = pc.localDescription;
      if (desc && hasUsableCandidates(desc.sdp)) {
        console.warn("[WebRTC] ICE gathering timed out but has candidates — proceeding");
        resolve(desc);
      } else {
        reject(new Error("ICE gathering timed out with no usable candidates. Check network/firewall."));
      }
    }, timeoutMs);

    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        pc.removeEventListener("icecandidate", onCandidate);
        const desc = pc.localDescription;
        if (desc && hasUsableCandidates(desc.sdp)) {
          resolve(desc);
        } else {
          reject(new Error("ICE gathering completed but no usable candidates found."));
        }
      }
    };

    const onCandidate = (ev: RTCPeerConnectionIceEvent) => {
      if (ev.candidate === null) {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        pc.removeEventListener("icecandidate", onCandidate);
        const desc = pc.localDescription;
        if (desc && hasUsableCandidates(desc.sdp)) {
          resolve(desc);
        } else {
          reject(new Error("ICE gathering ended (null candidate) with no usable candidates."));
        }
      }
    };

    pc.addEventListener("icegatheringstatechange", onStateChange);
    pc.addEventListener("icecandidate", onCandidate);
  });
}

/**
 * Count the number of ICE candidate lines in an SDP.
 */
export function countCandidates(sdp: string): number {
  const matches = sdp.match(/^a=candidate:/gm);
  return matches ? matches.length : 0;
}
