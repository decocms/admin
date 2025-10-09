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

export const extractResourceId = (uri: string) => {
  // Extract ID from Resources 2.0 URI format: rsc://integrationId/resourceName/resource-id
  const match = uri.match(/^rsc:\/\/[^\/]+\/[^\/]+\/(.+)$/);
  if (!match) {
    throw new Error("Invalid Resources 2.0 URI format");
  }
  return match[1];
};

export const constructResourceUri = (
  integrationId: string,
  resourceName: string,
  resourceId: string,
) => {
  return `rsc://${integrationId}/${resourceName}/${resourceId}`;
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

export const toAsyncIterator = <T>(emitter: EventSource): AsyncIterable<T> => {
  const queue: T[] = [];
  let done = false;
  let waitPromise: ((data?: T) => void) | null = null;

  const triggerLoop = () => {
    if (waitPromise) {
      waitPromise();
      waitPromise = null;
    }
  };

  emitter.addEventListener("change", (data) => {
    queue.push(JSON.parse(data.data));
    triggerLoop();
  });

  emitter.addEventListener("error", () => {
    done = true;
    triggerLoop();
  });

  return {
    async *[Symbol.asyncIterator]() {
      while (true) {
        const value = queue.shift();
        if (value) {
          yield value;
        } else {
          if (done) return;
          await new Promise((resolve) => (waitPromise = resolve));
        }
      }
    },
  };
};
