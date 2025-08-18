// JS build of logSafe (generated for non-TS runtime scripts)
const SENSITIVE_KEY_RE = /(token|key|secret|password|auth|bearer)/i;
function maskValue(v) {
  if (typeof v === "string") {
    if (v.length <= 6) return "***";
    return v.slice(0, 3) + "***" + v.slice(-2);
  }
  if (typeof v === "number" || typeof v === "boolean" || v == null) return v;
  if (Array.isArray(v)) return v.map(maskValue);
  if (typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? "***" : maskValue(val);
    }
    return out;
  }
  return "***";
}
export const logSafe = {
  info: (m, d) => {
    try {
      console.log(m, d ? maskValue(d) : undefined);
    } catch {}
  },
  warn: (m, d) => {
    try {
      console.warn(m, d ? maskValue(d) : undefined);
    } catch {}
  },
  error: (m, d) => {
    try {
      console.error(m, d ? maskValue(d) : undefined);
    } catch {}
  },
};
export default logSafe;
