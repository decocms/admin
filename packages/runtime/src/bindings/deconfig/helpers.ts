// Helper functions for DeconfigResource

export const normalizeDirectory = (dir: string) => {
  // Ensure directory starts with / and doesn't end with /
  const normalized = dir.startsWith("/") ? dir : `/${dir}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
};

export const ResourcePath = {
  build: (directory: string, resourceId: string) => {
    const normalizedDir = normalizeDirectory(directory);
    return `${normalizedDir}/${resourceId}.json`;
  },
  extract: (path: string) => {
    const match = path.match(/^(.+)\/(.+)\.json$/);
    if (!match) {
      throw new Error("Invalid resource path");
    }
    return { directory: match[1], resourceId: match[2] };
  },
};

export const ResourceUri = {
  build: (integrationId: string, resourceName: string, resourceId: string) => {
    return `rsc://${integrationId}/${resourceName}/${resourceId}`;
  },
  unwind: (uri: string) => {
    const match = uri.match(/^rsc:\/\/[^\/]+\/([^\/]+)\/(.+)$/);
    if (!match) {
      throw new Error("Invalid Resources 2.0 URI format");
    }
    return { resourceName: match[1], resourceId: match[2] };
  },
};

export function getMetadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object") return undefined;
  const metaObj = metadata as Record<string, unknown>;
  if (key in metaObj) return metaObj[key];
  const nested = metaObj.metadata;
  if (nested && typeof nested === "object" && key in nested) {
    return (nested as Record<string, unknown>)[key];
  }
  return undefined;
}

export function getMetadataString(
  metadata: unknown,
  key: string,
): string | undefined {
  const value = getMetadataValue(metadata, key);
  return typeof value === "string" ? value : undefined;
}

export const toAsyncIterator = <T>(
  emitter: EventSource,
  eventType: string = "message",
): AsyncIterable<T> => {
  const queue: T[] = [];
  let done = false;
  let waitPromise: ((data?: T) => void) | null = null;

  const triggerLoop = () => {
    if (waitPromise) {
      waitPromise();
      waitPromise = null;
    }
  };

  const messageHandler = (data: MessageEvent) => {
    try {
      queue.push(JSON.parse(data.data));
    } catch {
      // Silently ignore malformed data or optionally log error
      return;
    }
    triggerLoop();
  };

  const errorHandler = () => {
    done = true;
    triggerLoop();
  };

  emitter.addEventListener(eventType, messageHandler);
  emitter.addEventListener("error", errorHandler);

  return {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          const value = queue.shift();
          if (value) {
            yield value;
          } else {
            if (done) return;
            await new Promise((resolve) => (waitPromise = resolve));
          }
        }
      } finally {
        emitter.removeEventListener(eventType, messageHandler);
        emitter.removeEventListener("error", errorHandler);
        emitter.close();
      }
    },
  };
};
