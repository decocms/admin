// In-memory per-isolate metrics for tool executions (non-persistent)
// Tracks call count, errors, cumulative latency for average, and rolling p95 via ring buffer.

interface LatencyState {
  calls: number;
  errors: number;
  totalMs: number;
  recent: number[]; // circular buffer
  idx: number; // next write index
}

// Separate LLM aggregate metrics (cross-tool AI usage)
interface LlmState {
  calls: number;
  errors: number;
  totalMs: number;
  recent: number[];
  idx: number;
}
const LLM_RING = 100;
const llmState: LlmState = {
  calls: 0,
  errors: 0,
  totalMs: 0,
  recent: new Array<number>(LLM_RING),
  idx: 0,
};

const RING = 100; // window size for p95 estimation
const toolStates = new Map<string, LatencyState>();

function getState(tool: string): LatencyState {
  let s = toolStates.get(tool);
  if (!s) {
    s = {
      calls: 0,
      errors: 0,
      totalMs: 0,
      recent: new Array<number>(RING),
      idx: 0,
    };
    toolStates.set(tool, s);
  }
  return s;
}

function record(tool: string, ms: number, ok: boolean) {
  const s = getState(tool);
  s.calls++;
  if (!ok) s.errors++;
  s.totalMs += ms;
  s.recent[s.idx] = ms;
  s.idx = (s.idx + 1) % RING;
}

export function recordToolSuccess(tool: string, ms: number) {
  record(tool, ms, true);
}
export function recordToolError(tool: string, ms: number) {
  record(tool, ms, false);
}

function computeP95(samples: number[]): number | null {
  const vals = samples.filter((v) => typeof v === 'number' && !isNaN(v));
  if (!vals.length) return null;
  const sorted = vals.slice().sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor(0.95 * (sorted.length - 1)),
  );
  return sorted[idx];
}

export interface ToolMetricsSnapshotEntry {
  calls: number;
  errors: number;
  avgMs: number | null;
  p95Ms: number | null;
  errorRate: number | null;
}

export interface LlmMetricsSnapshotEntry {
  calls: number;
  errors: number;
  avgMs: number | null;
  p95Ms: number | null;
  errorRate: number | null;
}

export function toolMetricsSnapshot(): Record<
  string,
  ToolMetricsSnapshotEntry
> {
  const out: Record<string, ToolMetricsSnapshotEntry> = {};
  for (const [tool, s] of toolStates.entries()) {
    const avgMs = s.calls ? s.totalMs / s.calls : null;
    const p95Ms = computeP95(s.recent);
    out[tool] = {
      calls: s.calls,
      errors: s.errors,
      avgMs,
      p95Ms,
      errorRate: s.calls ? s.errors / s.calls : null,
    };
  }
  return out;
}

export function llmMetricsSnapshot(): LlmMetricsSnapshotEntry {
  const avgMs = llmState.calls ? llmState.totalMs / llmState.calls : null;
  const p95Ms = computeP95(llmState.recent);
  return {
    calls: llmState.calls,
    errors: llmState.errors,
    avgMs,
    p95Ms,
    errorRate: llmState.calls ? llmState.errors / llmState.calls : null,
  };
}

export function recordLlmSuccess(ms: number) {
  llmState.calls++;
  llmState.totalMs += ms;
  llmState.recent[llmState.idx] = ms;
  llmState.idx = (llmState.idx + 1) % LLM_RING;
}
export function recordLlmError(ms: number) {
  llmState.calls++;
  llmState.errors++;
  llmState.totalMs += ms;
  llmState.recent[llmState.idx] = ms;
  llmState.idx = (llmState.idx + 1) % LLM_RING;
}

export async function withToolMetrics<T>(
  tool: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const res = await fn();
    recordToolSuccess(tool, Date.now() - start);
    return res;
  } catch (e) {
    recordToolError(tool, Date.now() - start);
    throw e;
  }
}
