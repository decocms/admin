export interface EvaluationResult<T = unknown> {
  value?: T;
  error?: unknown;
  logs: Array<{ type: "log" | "warn" | "error"; content: string }>;
}

export interface Log {
  type: "log" | "warn" | "error";
  content: string;
}

export interface Builtin {
  [Symbol.dispose]: () => void;
}
