// Shared sanitized logger masking sensitive key values.
const SENSITIVE_KEY_RE = /(token|key|secret|password|auth|bearer)/i;

function maskValue(v: unknown): unknown {
  if (typeof v === "string") {
    if (v.length <= 6) return "***";
    return v.slice(0, 3) + "***" + v.slice(-2);
  }
  if (typeof v === "number" || typeof v === "boolean" || v == null) return v;
  if (Array.isArray(v)) return v.map(maskValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as any)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? "***" : maskValue(val);
    }
    return out;
  }
  return "***";
}

export const logSafe = {
  info: (msg: string, data?: any) => {
    try {
      console.log(msg, data ? maskValue(data) : undefined);
    } catch {}
  },
  warn: (msg: string, data?: any) => {
    try {
      console.warn(msg, data ? maskValue(data) : undefined);
    } catch {}
  },
  error: (msg: string, data?: any) => {
    try {
      console.error(msg, data ? maskValue(data) : undefined);
    } catch {}
  },
};

export type LogSafe = typeof logSafe;
