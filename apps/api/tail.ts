// deno-lint-ignore-file no-explicit-any

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
  message: string;
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

interface TailEvent {
  type: "trace" | "log";
  traces?: TailTrace[];
  logs?: TailLog[];
  exceptions?: TailException[];
  scriptName: string;
  rayId: string;
  timestamp: number;
  event: {
    request: {
      url: string;
      method: string;
      headers: Record<string, string>;
      cf: Record<string, string>;
    };
  };
}

function convertTailEventToOTLP(event: TailEvent): any {
  const resourceAttributes = [
    {
      key: "service.name",
      value: { stringValue: event.scriptName },
    },
    {
      key: "ray_id",
      value: { stringValue: event.rayId },
    },
    {
      key: "service.type",
      value: { stringValue: "app" },
    },
  ];

  // Create request attributes to be shared across logs and traces
  const requestAttributes = [
    {
      key: "http.url",
      value: { stringValue: event.event.request.url },
    },
    {
      key: "http.method",
      value: { stringValue: event.event.request.method },
    },
    {
      key: "ray_id",
      value: { stringValue: event.rayId },
    },
    // Add Cloudflare specific data
    ...(event.event.request.cf?.colo
      ? [
          {
            key: "cf.colo",
            value: { stringValue: event.event.request.cf.colo },
          },
        ]
      : []),
    // Add important headers (excluding sensitive ones)
    ...Object.entries(event.event.request.headers)
      .filter(
        ([key]) =>
          !key.toLowerCase().includes("authorization") &&
          !key.toLowerCase().includes("cookie"),
      )
      .map(([key, value]) => ({
        key: `http.request.header.${key.toLowerCase()}`,
        value: { stringValue: value },
      })),
  ];

  // Convert traces to OTLP format
  const resourceSpans =
    event.traces && event.traces.length > 0
      ? [
          {
            resource: {
              attributes: resourceAttributes,
            },
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
                    ...requestAttributes, // Add request info to traces
                  ],
                })),
              },
            ],
          },
        ]
      : [];

  // Convert logs to OTLP format
  const resourceLogs =
    event.logs && event.logs.length > 0
      ? [
          {
            resource: {
              attributes: resourceAttributes,
            },
            scopeLogs: [
              {
                scope: {},
                logRecords: event.logs.map((log) => ({
                  timeUnixNano: event.timestamp * 1000000,
                  severityText: log.level,
                  body: { stringValue: log.message },
                  attributes: [
                    ...requestAttributes, // Add request info to logs
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
                })),
              },
            ],
          },
        ]
      : [];

  // Convert exceptions to log records (OTLP doesn't have a separate exception format)
  const exceptionLogs =
    event.exceptions && event.exceptions.length > 0
      ? [
          {
            resource: {
              attributes: resourceAttributes,
            },
            scopeLogs: [
              {
                scope: {},
                logRecords: event.exceptions.map((exception) => ({
                  timeUnixNano: event.timestamp * 1000000,
                  severityText: "ERROR",
                  body: { stringValue: exception.message },
                  attributes: [
                    ...requestAttributes, // Add request info to exceptions
                    {
                      key: "exception.type",
                      value: { stringValue: exception.name },
                    },
                  ],
                })),
              },
            ],
          },
        ]
      : [];

  // Combine all logs (regular logs + exceptions)
  const allResourceLogs = [...resourceLogs, ...exceptionLogs];

  // Create the combined OTLP payload
  const otlpPayload: any = {};

  if (resourceSpans.length > 0) {
    otlpPayload.resourceSpans = resourceSpans;
  }

  if (allResourceLogs.length > 0) {
    otlpPayload.resourceLogs = allResourceLogs;
  }

  return otlpPayload;
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
    for (const event of events) {
      // Convert to combined OTLP format
      const otlpPayload = convertTailEventToOTLP(event);

      // Only send if there's actually data to send
      if (Object.keys(otlpPayload).length > 0) {
        await fetch(env.OTEL_EXPORTER_OTLP_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...otelHeadersToObject(env.OTEL_EXPORTER_OTLP_HEADERS),
          },
          body: JSON.stringify(otlpPayload),
        });
      }
    }
  } catch (error) {
    console.error("Error processing tail events:", error);
  }
}
