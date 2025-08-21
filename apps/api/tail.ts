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

interface TailEvent {
  type: "trace" | "log";
  traces?: TailTrace[];
  logs?: TailLog[];
  exceptions?: TailException[];
  scriptName: string;
  outcome: "exception" | string;
  eventTimestamp?: number;
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

const parse = (scriptName: string) => {
  const [name, version] = scriptName.split("--"); // double-dash

  return {
    name,
    version,
  };
};
function convertTailLogs(event: TailEvent): any {
  if (!event.logs) return null;

  const { name, version } = parse(event.scriptName);

  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: name },
            },
            {
              key: "service.version",
              value: { stringValue: version || "unknown" },
            },
            {
              key: "ray_id",
              value: { stringValue: event.rayId },
            },
            {
              key: "http.url",
              value: { stringValue: event.event.request.url },
            },
            {
              key: "http.method",
              value: { stringValue: event.event.request.method },
            },
            {
              key: "cf.colo",
              value: { stringValue: event.event.request.cf?.colo || "unknown" },
            },
            {
              key: "outcome",
              value: { stringValue: event.outcome },
            },
          ],
        },
        scopeLogs: [
          {
            scope: {},
            logRecords: event.logs.map((log) => {
              // Handle both string and array message formats
              const message = Array.isArray(log.message)
                ? log.message.join(" ")
                : log.message;

              return {
                timeUnixNano: event.timestamp * 1000000,
                severityText: log.level,
                body: { stringValue: message },
                attributes: [
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
  if (!event.exceptions) return null;

  const { name, version } = parse(event.scriptName);

  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: name },
            },
            {
              key: "service.version",
              value: { stringValue: version || "unknown" },
            },
            {
              key: "ray_id",
              value: { stringValue: event.rayId },
            },
            {
              key: "http.url",
              value: { stringValue: event.event.request.url },
            },
            {
              key: "http.method",
              value: { stringValue: event.event.request.method },
            },
            {
              key: "cf.colo",
              value: { stringValue: event.event.request.cf?.colo || "unknown" },
            },
            {
              key: "outcome",
              value: { stringValue: event.outcome },
            },
          ],
        },
        scopeLogs: [
          {
            scope: {},
            logRecords: event.exceptions.map((exception) => ({
              timeUnixNano: event.timestamp * 1000000,
              severityText: "ERROR",
              body: { stringValue: exception.message },
              attributes: [
                {
                  key: "exception.type",
                  value: { stringValue: exception.name },
                },
              ],
            })),
          },
        ],
      },
    ],
  };
}

function convertTailTraces(event: TailEvent): any {
  if (!event.traces) return null;

  const { name, version } = parse(event.scriptName);

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: name },
            },
            {
              key: "service.version",
              value: { stringValue: version || "unknown" },
            },
            {
              key: "ray_id",
              value: { stringValue: event.rayId },
            },
            {
              key: "http.url",
              value: { stringValue: event.event.request.url },
            },
            {
              key: "http.method",
              value: { stringValue: event.event.request.method },
            },
            {
              key: "cf.colo",
              value: { stringValue: event.event.request.cf?.colo || "unknown" },
            },
            {
              key: "outcome",
              value: { stringValue: event.outcome },
            },
          ],
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
              attributes: Object.entries(trace.attributes || {}).map(
                ([key, value]) => ({
                  key,
                  value: convertAttributeValue(value),
                }),
              ),
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

function otelHeadersToObject(headers: string) {
  return headers.split(";").reduce((acc: Record<string, string>, header) => {
    const [key, value] = header.split("=");
    acc[key] = value;
    return acc;
  }, {});
}

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
    console.log({ events });

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

export default { tail };
