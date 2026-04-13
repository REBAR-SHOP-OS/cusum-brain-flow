
/**
 * Shared WebRTC helpers for OpenAI Realtime connections.
 *
 * ICE server configuration:
 * - STUN servers are always included (Google + Cloudflare, free & reliable).
 * - TURN servers are added only when VITE_TURN_URL, VITE_TURN_USERNAME,
 *   and VITE_TURN_CREDENTIAL env vars are set. This keeps credentials
 *   out of source and lets each environment bring its own TURN relay.
 *
 * SDP strategy: We do NOT wait for ICE gathering to complete before
 * sending the SDP offer to OpenAI. The browser and server perform ICE
 * connectivity checks asynchronously after setRemoteDescription.
 */

/** Always-on STUN servers for reflexive candidate discovery */
const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * Build the full ICE server list.
 *
 * TURN is included only when all three env vars are present:
 *   VITE_TURN_URL        – e.g. "turn:relay.example.com:443"
 *   VITE_TURN_USERNAME    – credential username
 *   VITE_TURN_CREDENTIAL  – credential password
 *
 * Multiple TURN URLs can be comma-separated in VITE_TURN_URL:
 *   "turn:relay.example.com:443,turns:relay.example.com:443"
 */
export function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...STUN_SERVERS];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    const urls = turnUrl.split(",").map((u: string) => u.trim()).filter(Boolean);
    if (urls.length > 0) {
      servers.push({ urls, username: turnUser, credential: turnCred });
      console.log(`[WebRTC] TURN configured: ${urls.length} URL(s)`);
    }
  } else {
    console.log("[WebRTC] No TURN configured (STUN-only). Set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL to enable.");
  }

  return servers;
}

/**
 * Create an RTCPeerConnection pre-configured with STUN (+ optional TURN).
 * Uses max-bundle to reduce ICE candidates and speed up connectivity.
 */
export function createRealtimePeerConnection(): RTCPeerConnection {
  const iceServers = buildIceServers();
  return new RTCPeerConnection({
    iceServers,
    bundlePolicy: "max-bundle",
    iceCandidatePoolSize: 1,
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
 * Wait for ICE gathering to complete (or timeout).
 * Returns the full local description with all candidates baked in.
 *
 * NOTE: For OpenAI Realtime, you typically do NOT need this — send the offer
 * immediately and let ICE resolve asynchronously. This helper is kept for
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
