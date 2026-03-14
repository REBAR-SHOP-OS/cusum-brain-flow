/**
 * Browser-side camera ping for private/LAN IPs.
 * Uses no-cors fetch — an opaque response still means "reachable".
 */

export interface BrowserPingResult {
  reachable: boolean;
  latency_ms: number;
  method: "browser";
}

/** Detect RFC 1918 private IP ranges */
export function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false;
  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

/** Attempt HTTP fetch from browser to camera IP (works on LAN) */
export async function browserPing(ip: string, port?: number): Promise<BrowserPingResult> {
  const target = port && port !== 554 ? `http://${ip}:${port}/` : `http://${ip}/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const start = Date.now();

  try {
    await fetch(target, { mode: "no-cors", signal: controller.signal });
    clearTimeout(timer);
    return { reachable: true, latency_ms: Date.now() - start, method: "browser" };
  } catch (err: any) {
    clearTimeout(timer);
    // AbortError = timeout = unreachable. TypeError/NetworkError = also unreachable.
    return { reachable: false, latency_ms: Date.now() - start, method: "browser" };
  }
}
