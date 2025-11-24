/* oxlint-disable no-explicit-any */

// Interface for trace events from tail
interface TailTrace {
  trace_id: string;
  parent_id?: string;
  span_id: string;
  start_time_ms: number;
  end_time_ms: number;
  name: string;
  kind: string;
  events: Array<{
    name: string;
    attributes: Record<string, any>;
  }>;
  attributes: Record<string, any>;
}

// Interface for log events from tail
interface TailLog {
  level: string;
  message: string | string[];
  timestamp: number;
  traces?: {
    trace_id: string;
    span_id: string;
  };
}

interface TailException {
  name: string;
  message: string;
  timestamp: number;
}

// Updated interface to match the real structure from source
interface TailEvent {
  diagnosticsChannelEvents: any[];
  exceptions: TailException[];
  logs: TailLog[];
  traces?: TailTrace[];
  truncated: boolean;
  executionModel: string;
  outcome: string;
  scriptTags: string[]; // Array, not object with numeric keys
  dispatchNamespace: string;
  scriptVersion: {
    id: string;
  };
  scriptName: string;
  entrypoint?: string;
  event: {
    request?: {
      url: string;
      method: string;
      headers: Record<string, string>;
    };
    response?: {
      status: number;
    };
    rpcMethod?: string;
  };
  wallTime: number;
  cpuTime: number;
  eventTimestamp: number;
}

function parse(scriptName: string) {
  const [name, version] = scriptName.split("--");
  return {
    name,
    version,
  };
}

// Create a request log for every event (even when no explicit logs/traces/exceptions)
function convertEventToRequestLog(event: TailEvent): any {
  const { name, version } = parse(event.scriptName);
  const workspace = event.scriptTags[0] || "unknown";

  const baseAttributes: any[] = [
    { key: "service.name", value: { stringValue: name } },
    { key: "service.version", value: { stringValue: version || "unknown" } },
    { key: "workspace", value: { stringValue: workspace } },
    { key: "outcome", value: { stringValue: event.outcome } },
    { key: "execution_model", value: { stringValue: event.executionModel } },
    {
      key: "dispatch_namespace",
      value: { stringValue: event.dispatchNamespace },
    },
  ];

  const hasRequest = !!event.event?.request;
  const attributes: any[] = [...baseAttributes];
  if (hasRequest) {
    attributes.push(
      { key: "http.url", value: { stringValue: event.event!.request!.url } },
      {
        key: "http.method",
        value: { stringValue: event.event!.request!.method },
      },
      {
        key: "http.status_code",
        value: { intValue: event.event?.response?.status || 0 },
      },
    );
  } else {
    if (event.event?.rpcMethod) {
      attributes.push({
        key: "rpc.method",
        value: { stringValue: event.event.rpcMethod },
      });
    }
    if (event.entrypoint) {
      attributes.push({
        key: "entrypoint",
        value: { stringValue: event.entrypoint },
      });
    }
  }

  const bodyString = hasRequest
    ? `${event.event!.request!.method} ${event.event!.request!.url} - ${
        event.event?.response?.status ?? "no response"
      } - ${event.wallTime}ms (CPU: ${event.cpuTime}ms)`
    : `DO ${event.entrypoint || "unknown"}.${
        event.event?.rpcMethod || "unknown"
      } - ${event.wallTime}ms (CPU: ${event.cpuTime}ms)`;

  return {
    resourceLogs: [
      {
        resource: { attributes },
        scopeLogs: [
          {
            scope: {},
            logRecords: [
              {
                timeUnixNano: event.eventTimestamp * 1000000,
                severityText: "INFO",
                body: { stringValue: bodyString },
                attributes: [
                  { key: "wall_time_ms", value: { intValue: event.wallTime } },
                  { key: "cpu_time_ms", value: { intValue: event.cpuTime } },
                  { key: "truncated", value: { boolValue: event.truncated } },
                  // Add important headers (excluding sensitive ones) only if request exists
                  ...(hasRequest
                    ? Object.entries(event.event!.request!.headers)
                        .filter(
                          ([key]) =>
                            !key.toLowerCase().includes("authorization") &&
                            !key.toLowerCase().includes("cookie") &&
                            !key.toLowerCase().includes("x-real-ip"),
                        )
                        .slice(0, 10)
                        .map(([key, value]) => ({
                          key: `http.request.header.${key.toLowerCase()}`,
                          value: { stringValue: value },
                        }))
                    : []),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function convertTailLogs(event: TailEvent): any {
  if (!event.logs || event.logs.length === 0) return null;

  const { name, version } = parse(event.scriptName);
  const workspace = event.scriptTags[0] || "unknown";

  const baseAttributes: any[] = [
    { key: "service.name", value: { stringValue: name } },
    { key: "service.version", value: { stringValue: version || "unknown" } },
    { key: "workspace", value: { stringValue: workspace } },
    { key: "outcome", value: { stringValue: event.outcome } },
  ];
  const attributes: any[] = [...baseAttributes];
  if (event.event?.request) {
    attributes.push(
      { key: "http.url", value: { stringValue: event.event.request.url } },
      {
        key: "http.method",
        value: { stringValue: event.event.request.method },
      },
      {
        key: "http.status_code",
        value: { intValue: event.event.response?.status || 0 },
      },
    );
  } else {
    if (event.event?.rpcMethod) {
      attributes.push({
        key: "rpc.method",
        value: { stringValue: event.event.rpcMethod },
      });
    }
    if (event.entrypoint) {
      attributes.push({
        key: "entrypoint",
        value: { stringValue: event.entrypoint },
      });
    }
  }

  return {
    resourceLogs: [
      {
        resource: { attributes },
        scopeLogs: [
          {
            scope: {},
            logRecords: event.logs.map((log) => {
              // Handle both string and array message formats
              const message = Array.isArray(log.message)
                ? log.message.join(" ")
                : log.message;

              return {
                timeUnixNano: event.eventTimestamp * 1000000,
                severityText: log.level,
                body: { stringValue: message },
                attributes: [
                  { key: "wall_time_ms", value: { intValue: event.wallTime } },
                  { key: "cpu_time_ms", value: { intValue: event.cpuTime } },
                  ...(log.traces?.trace_id
                    ? [
                        {
                          key: "trace_id",
                          value: { stringValue: log.traces.trace_id },
                        },
                      ]
                    : []),
                  ...(log.traces?.span_id
                    ? [
                        {
                          key: "span_id",
                          value: { stringValue: log.traces.span_id },
                        },
                      ]
                    : []),
                ],
              };
            }),
          },
        ],
      },
    ],
  };
}

function convertTailExceptions(event: TailEvent): any {
  if (!event.exceptions || event.exceptions.length === 0) return null;

  const { name, version } = parse(event.scriptName);
  const workspace = event.scriptTags[0] || "unknown";

  const baseAttributes: any[] = [
    { key: "service.name", value: { stringValue: name } },
    { key: "service.version", value: { stringValue: version || "unknown" } },
    { key: "workspace", value: { stringValue: workspace } },
    { key: "outcome", value: { stringValue: event.outcome } },
  ];
  const attributes: any[] = [...baseAttributes];
  if (event.event?.request) {
    attributes.push(
      { key: "http.url", value: { stringValue: event.event.request.url } },
      {
        key: "http.method",
        value: { stringValue: event.event.request.method },
      },
      {
        key: "http.status_code",
        value: { intValue: event.event.response?.status || 0 },
      },
    );
  } else {
    if (event.event?.rpcMethod) {
      attributes.push({
        key: "rpc.method",
        value: { stringValue: event.event.rpcMethod },
      });
    }
    if (event.entrypoint) {
      attributes.push({
        key: "entrypoint",
        value: { stringValue: event.entrypoint },
      });
    }
  }

  return {
    resourceLogs: [
      {
        resource: { attributes },
        scopeLogs: [
          {
            scope: {},
            logRecords: event.exceptions.map((exception) => ({
              timeUnixNano: event.eventTimestamp * 1000000,
              severityText: "ERROR",
              body: { stringValue: exception.message },
              attributes: [
                {
                  key: "exception.type",
                  value: { stringValue: exception.name },
                },
                { key: "wall_time_ms", value: { intValue: event.wallTime } },
                { key: "cpu_time_ms", value: { intValue: event.cpuTime } },
              ],
            })),
          },
        ],
      },
    ],
  };
}

function convertTailTraces(event: TailEvent): any {
  if (!event.traces || event.traces.length === 0) return null;

  const { name, version } = parse(event.scriptName);
  const workspace = event.scriptTags[0] || "unknown";

  const baseAttributes: any[] = [
    { key: "service.name", value: { stringValue: name } },
    { key: "service.version", value: { stringValue: version || "unknown" } },
    { key: "workspace", value: { stringValue: workspace } },
    { key: "outcome", value: { stringValue: event.outcome } },
  ];
  const attributes: any[] = [...baseAttributes];
  if (event.event?.request) {
    attributes.push(
      { key: "http.url", value: { stringValue: event.event.request.url } },
      {
        key: "http.method",
        value: { stringValue: event.event.request.method },
      },
      {
        key: "http.status_code",
        value: { intValue: event.event.response?.status || 0 },
      },
    );
  } else {
    if (event.event?.rpcMethod) {
      attributes.push({
        key: "rpc.method",
        value: { stringValue: event.event.rpcMethod },
      });
    }
    if (event.entrypoint) {
      attributes.push({
        key: "entrypoint",
        value: { stringValue: event.entrypoint },
      });
    }
  }

  return {
    resourceSpans: [
      {
        resource: { attributes },
        scopeSpans: [
          {
            scope: {},
            spans: event.traces.map((trace) => ({
              traceId: trace.trace_id,
              spanId: trace.span_id,
              parentSpanId: trace.parent_id || undefined,
              name: trace.name,
              kind: mapSpanKind(trace.kind),
              startTimeUnixNano: trace.start_time_ms * 1000000,
              endTimeUnixNano: trace.end_time_ms * 1000000,
              attributes: [
                ...Object.entries(trace.attributes || {}).map(
                  ([key, value]) => ({
                    key,
                    value: convertAttributeValue(value),
                  }),
                ),
                { key: "wall_time_ms", value: { intValue: event.wallTime } },
                { key: "cpu_time_ms", value: { intValue: event.cpuTime } },
              ],
            })),
          },
        ],
      },
    ],
  };
}

function mapSpanKind(kind: string): number {
  const kinds: Record<string, number> = {
    INTERNAL: 1,
    SERVER: 2,
    CLIENT: 3,
    PRODUCER: 4,
    CONSUMER: 5,
  };
  return kinds[kind.toUpperCase()] || 1;
}

function convertAttributeValue(value: any): { [key: string]: any } {
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { intValue: value };
    }
    return { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(convertAttributeValue) } };
  }
  return { stringValue: JSON.stringify(value) };
}

const otelHeadersToObject = (headers: string) => {
  const headersParts = headers
    .split(",")
    .map((kv) => kv.split("=") as [string, string]);
  return Object.fromEntries(headersParts);
};

export async function tail(
  events: TailEvent[],
  env: {
    OTEL_EXPORTER_OTLP_ENDPOINT: string;
    OTEL_EXPORTER_OTLP_HEADERS: string;
  },
): Promise<void> {
  try {
    // Parse the authorization header
    const headers = otelHeadersToObject(env.OTEL_EXPORTER_OTLP_HEADERS);

    const ingestTraces = <TEvent = unknown>(evt: TEvent) => {
      return fetch(`${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(evt),
      }).then((res) => {
        console.log("Traces response:", res.status);
      });
    };

    const ingestLogs = <TEvent = unknown>(evt: TEvent) => {
      return fetch(`${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(evt),
      }).then((res) => {
        console.log("Logs response:", res.status);
      });
    };

    for (const event of events) {
      // Always create a request (or durable object) log for every event
      const requestLog = convertEventToRequestLog(event);
      await ingestLogs(requestLog);

      // Handle traces using OTLP format to /v1/traces
      if (event.traces && event.traces.length > 0) {
        const traceData = convertTailTraces(event);
        traceData && (await ingestTraces(traceData));
      }

      // Handle logs using OTLP format to /v1/logs
      if (event.logs && event.logs.length > 0) {
        const logData = convertTailLogs(event);
        logData && (await ingestLogs(logData));
      }

      // Handle exceptions as logs to /v1/logs
      if (event.exceptions && event.exceptions.length > 0) {
        const exceptionData = convertTailExceptions(event);
        exceptionData && (await ingestLogs(exceptionData));
      }
    }
  } catch (error) {
    console.error("Error processing tail events:", error);
  }
}
