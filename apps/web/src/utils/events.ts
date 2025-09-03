// Centralized custom event helpers

// Resource mention lifecycle events
export interface ResourceLoadingDetail {
  clientId: string;
  name?: string;
  contentType?: string;
}

export interface ResourceLoadedDetail {
  clientId: string;
  url: string;
  name?: string;
  contentType?: string;
}

export interface ResourceErrorDetail {
  clientId: string;
  error?: string;
}

type EventMap = {
  "deco:resource-loading": ResourceLoadingDetail;
  "deco:resource-loaded": ResourceLoadedDetail;
  "deco:resource-error": ResourceErrorDetail;
  "deco:rules-updated": { rules: string[] };
};

// Generic helper to add a typed listener
export function onEvent<K extends keyof EventMap>(
  name: K,
  listener: (event: CustomEvent<EventMap[K]>) => void,
): () => void {
  const wrapped = listener as EventListener;
  globalThis.addEventListener(name, wrapped as EventListener);
  return () => globalThis.removeEventListener(name, wrapped as EventListener);
}

// Generic helper to dispatch a typed event
export function dispatchEvent<K extends keyof EventMap>(
  name: K,
  detail: EventMap[K],
) {
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
}

// Specific helpers for better DX
export function onResourceLoading(
  listener: (event: CustomEvent<ResourceLoadingDetail>) => void,
) {
  return onEvent("deco:resource-loading", listener);
}

export function onResourceLoaded(
  listener: (event: CustomEvent<ResourceLoadedDetail>) => void,
) {
  return onEvent("deco:resource-loaded", listener);
}

export function onResourceError(
  listener: (event: CustomEvent<ResourceErrorDetail>) => void,
) {
  return onEvent("deco:resource-error", listener);
}

export function dispatchResourceLoading(detail: ResourceLoadingDetail) {
  dispatchEvent("deco:resource-loading", detail);
}

export function dispatchResourceLoaded(detail: ResourceLoadedDetail) {
  dispatchEvent("deco:resource-loaded", detail);
}

export function dispatchResourceError(detail: ResourceErrorDetail) {
  dispatchEvent("deco:resource-error", detail);
}

export function onRulesUpdated(
  listener: (event: CustomEvent<{ rules: string[] }>) => void,
) {
  return onEvent("deco:rules-updated", listener);
}

export function dispatchRulesUpdated(detail: { rules: string[] }) {
  dispatchEvent("deco:rules-updated", detail);
}
