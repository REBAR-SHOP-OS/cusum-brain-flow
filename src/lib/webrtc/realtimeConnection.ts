
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

/**
 * Build the full ICE server list with hardcoded Metered TURN relay.
 */
export function buildIceServers(): RTCIceServer[] {
  return [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turn:global.relay.metered.ca:443",
        "turns:global.relay.metered.ca:443?transport=tcp",
      ],
      username: "1f355748924a8518adb04a1d",
      credential: "Jk2Qk0D4BlbnSyB9",
    },
  ];
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
