/**
 * Shared WebRTC helpers for OpenAI Realtime connections.
 *
 * Key design decision: We do NOT wait for ICE gathering to complete before
 * sending the SDP offer to OpenAI. The OpenAI Realtime API handles ICE on
 * its side — the browser and server perform ICE connectivity checks
 * asynchronously after setRemoteDescription.
 */

/** STUN + free TURN servers for NAT traversal */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  // Free TURN relay from OpenRelay (metered.ca) for symmetric NAT / firewall fallback
  {
    urls: "turn:a.relay.metered.ca:80",
    username: "e8dd65b92f6b809b5b145572",
    credential: "3zaaENIxOurmxCaP",
  },
  {
    urls: "turn:a.relay.metered.ca:80?transport=tcp",
    username: "e8dd65b92f6b809b5b145572",
    credential: "3zaaENIxOurmxCaP",
  },
  {
    urls: "turn:a.relay.metered.ca:443",
    username: "e8dd65b92f6b809b5b145572",
    credential: "3zaaENIxOurmxCaP",
  },
  {
    urls: "turns:a.relay.metered.ca:443",
    username: "e8dd65b92f6b809b5b145572",
    credential: "3zaaENIxOurmxCaP",
  },
];

/**
 * Create an RTCPeerConnection pre-configured with STUN + TURN servers.
 * Uses max-bundle to reduce ICE candidates and speed up connectivity.
 */
export function createRealtimePeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: ICE_SERVERS,
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
 * Count the number of ICE candidate lines in an SDP.
 */
export function countCandidates(sdp: string): number {
  const matches = sdp.match(/^a=candidate:/gm);
  return matches ? matches.length : 0;
}
