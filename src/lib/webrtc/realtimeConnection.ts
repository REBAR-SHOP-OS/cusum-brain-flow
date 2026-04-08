/**
 * Shared WebRTC helpers for OpenAI Realtime connections.
 * Ensures proper ICE gathering before SDP is sent.
 */

/** Public STUN servers for NAT traversal */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * Create an RTCPeerConnection pre-configured with public STUN servers.
 */
export function createRealtimePeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

/**
 * Wait for ICE gathering to complete (or timeout).
 * Returns the full local description with all candidates baked in.
 *
 * @throws if no usable candidates are gathered within the timeout.
 */
export async function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 8000
): Promise<RTCSessionDescription> {
  // If already complete, return immediately
  if (pc.iceGatheringState === "complete" && pc.localDescription) {
    return pc.localDescription;
  }

  return new Promise<RTCSessionDescription>((resolve, reject) => {
    const timer = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      pc.removeEventListener("icecandidate", onCandidate);

      // Even on timeout, if we have some candidates, proceed
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

    // Also watch for the null candidate sentinel (end-of-candidates)
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
 * Check if an SDP string contains at least one real ICE candidate line.
 */
export function hasUsableCandidates(sdp: string): boolean {
  // a=candidate: lines that are NOT end-of-candidates
  const candidateLines = sdp.match(/^a=candidate:/gm);
  return !!candidateLines && candidateLines.length > 0;
}

/**
 * Count the number of ICE candidate lines in an SDP.
 */
export function countCandidates(sdp: string): number {
  const matches = sdp.match(/^a=candidate:/gm);
  return matches ? matches.length : 0;
}
