export interface ParsedCameraQr {
  uid?: string;
  username?: string;
  password?: string;
  ip_address?: string;
  port?: number;
  channel?: number;
}

const FIELD_MAP: Record<string, keyof ParsedCameraQr> = {
  uid: "uid",
  id: "uid",
  deviceid: "uid",
  device_id: "uid",
  user: "username",
  username: "username",
  usr: "username",
  pass: "password",
  password: "password",
  pwd: "password",
  ip: "ip_address",
  ip_address: "ip_address",
  host: "ip_address",
  port: "port",
  channel: "channel",
  ch: "channel",
};

function assignField(result: ParsedCameraQr, key: string, value: string) {
  const normalised = key.toLowerCase().replace(/[-\s]/g, "_");
  const mapped = FIELD_MAP[normalised];
  if (!mapped || !value) return;
  if (mapped === "port" || mapped === "channel") {
    const n = parseInt(value, 10);
    if (!isNaN(n)) (result as any)[mapped] = n;
  } else {
    (result as any)[mapped] = value;
  }
}

export function parseReolinkQr(raw: string): ParsedCameraQr {
  const text = raw.trim();
  const result: ParsedCameraQr = {};

  // 1. Try JSON
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" || typeof v === "number") {
          assignField(result, k, String(v));
        }
      }
      if (Object.keys(result).length > 0) return result;
    } catch { /* not JSON */ }
  }

  // 2. Try URL query-string style (key=val&key=val)
  if (text.includes("=")) {
    const params = new URLSearchParams(text.includes("?") ? text.split("?")[1] : text);
    for (const [k, v] of params.entries()) {
      assignField(result, k, v);
    }
    if (Object.keys(result).length > 0) return result;
  }

  // 3. Try semicolon / newline delimited key:value or key=value
  const lines = text.split(/[;\n\r]+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    for (const line of lines) {
      const sep = line.includes("=") ? "=" : ":";
      const idx = line.indexOf(sep);
      if (idx > 0) {
        assignField(result, line.slice(0, idx).trim(), line.slice(idx + 1).trim());
      }
    }
    if (Object.keys(result).length > 0) return result;
  }

  // 4. Fallback — treat entire string as UID
  result.uid = text;
  return result;
}
