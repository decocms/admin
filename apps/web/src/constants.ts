export const ALLOWANCES = [
  "camera",
  "microphone",
  "display-capture",
  "autoplay",
  "accelerometer",
  "clipboard-write",
  "encrypted-media",
  "gyroscope",
  "picture-in-picture",
  "web-share",
  "fullscreen",
  "geolocation",
  "payment",
].join("; ");

export const POSTHOG_PROJECT_API_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

export const POSTHOG_ORIGIN = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

// Uncomment this if you want to test event tracking in development
// export const POSTHOG_SHOULD_TRACK = true;
export const POSTHOG_SHOULD_TRACK = import.meta.env.MODE !== "development";

// MCP Registry metadata namespaces
export const MCP_METADATA_NAMESPACE_DECO = "deco/internal";
