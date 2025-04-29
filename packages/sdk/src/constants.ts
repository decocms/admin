/**
 * Determines if the application should use local backend services.
 *
 * By default, LOCAL_DEBUGGER will be false.
 * If the environment variable VITE_USE_LOCAL_BACKEND is set to 'true',
 * it will use the localhost version.
 */
// @ts-ignore - Vite injects env variables at build time
const LOCAL_DEBUGGER = import.meta.env?.VITE_USE_LOCAL_BACKEND === "true";
const isLocalhost = globalThis.location?.hostname === "localhost";

// Log a warning if the environment variable is not set
// @ts-ignore - Vite injects env variables at build time
if (isLocalhost && import.meta.env?.VITE_USE_LOCAL_BACKEND === undefined) {
  console.warn(
    "VITE_USE_LOCAL_BACKEND environment variable is not set. " +
      "To use local backend services, create a .env file in apps/web/ " +
      "and add VITE_USE_LOCAL_BACKEND=true",
  );
}

export const API_SERVER_URL = LOCAL_DEBUGGER
  ? "http://localhost:8000"
  : "https://fs.deco.chat";

export const AUTH_URL = LOCAL_DEBUGGER
  ? "http://localhost:5173"
  : "https://auth.deco.chat";

export const API_HEADERS = {
  "content-type": "application/json",
  "use-api-host": "true",
} as const;

export const WELL_KNOWN_AGENT_IDS = {
  teamAgent: "teamAgent",
  setupAgent: "setupAgent",
};

export interface Model {
  id: string;
  name: string;
  logo: string;
  capabilities: Capability[];
  legacyId?: string;
}

const LOGOS = {
  openai:
    "https://assets.decocache.com/webdraw/15dc381c-23b4-4f6b-9ceb-9690f77a7cf5/openai.svg",
  anthropic:
    "https://assets.decocache.com/webdraw/6780dee0-80d6-4c83-bf4f-8e5773d867ea/claude.png",
  google:
    "https://assets.decocache.com/webdraw/eb7480aa-a68b-4ce4-98ff-36aa121762a7/google.svg",
  xai:
    "https://assets.decocache.com/webdraw/7a8003ff-8f2d-4988-8693-3feb20e87eca/xai.svg",
};

export const DEFAULT_REASONING_MODEL = "google:gemini-2.5-pro-preview-03-25";

type Capability =
  | "reasoning"
  | "image-upload"
  | "file-upload"
  | "web-search";

export const MODELS: Model[] = [
  {
    id: "google:gemini-2.5-pro-preview-03-25",
    name: "Google Gemini 2.5 Pro",
    logo: LOGOS.google,
    capabilities: ["reasoning", "image-upload", "file-upload", "web-search"],
  },
  {
    id: "anthropic:claude-3.7-sonnet:thinking",
    name: "Claude 3.7 Sonnet",
    logo: LOGOS.anthropic,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    legacyId: "anthropic:claude-3-7-sonnet-20250219",
  },
  {
    id: "openai:gpt-4.1",
    name: "OpenAI GPT-4.1",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
  },
  {
    id: "openai:gpt-4.1-mini",
    name: "OpenAI GPT-4.1 mini",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
  },
  {
    id: "openai:gpt-4.1-nano",
    name: "OpenAI GPT-4.1 nano",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload"],
  },
  {
    id: "x-ai:grok-3-beta",
    name: "Grok 3 Beta",
    logo: LOGOS.xai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
  },
  {
    id: "openai:o3-mini-high",
    name: "OpenAI o3-mini",
    logo: LOGOS.openai,
    capabilities: ["reasoning"],
  },
  // {
  //   id: "deepseek:deepseek-r1-distill-llama-8b",
  //   name: "DeepSeek R1 Distill Llama 8B",
  //   logo:
  //     "https://assets.decocache.com/webdraw/798dda7c-f79e-4622-bca7-05552560fd40/deepseek.svg",
  //   capabilities: ["reasoning"],
  // },
];

/**
 * Gets the trace debug ID from the URL or generates a new one
 * @returns The trace debug ID
 */
export function getTraceDebugId(): string {
  return new URL(globalThis.location.href).searchParams.get("__d") ||
    crypto.randomUUID();
}
