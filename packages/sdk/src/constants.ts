/**
 * Determines if the application should use local backend services.
 *
 * By default, LOCAL_DEBUGGER will be false.
 * If the environment variable VITE_USE_LOCAL_BACKEND is set to 'true',
 * it will use the localhost version.
 */

import { Agent } from "./models/agent.ts";
import { Integration } from "./models/mcp.ts";

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

export const LEGACY_API_SERVER_URL = LOCAL_DEBUGGER
  ? "http://localhost:8000"
  : "https://fs.deco.chat";

export const API_SERVER_URL = LOCAL_DEBUGGER
  ? "http://localhost:3001"
  : "https://api.deco.chat";

export const AUTH_URL = LOCAL_DEBUGGER
  ? "http://localhost:3001"
  : "https://api.deco.chat";

export const API_HEADERS = {
  "content-type": "application/json",
  "use-api-host": "true",
} as const;

export const WELL_KNOWN_AGENT_IDS = {
  teamAgent: "teamAgent",
  setupAgent: "setupAgent",
} as const;

export interface Model {
  id: string;
  name: string;
  logo: string;
  capabilities: Capability[];
  legacyId?: string;
  description?: string;
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

export const DEFAULT_MODEL = "auto";

type Capability =
  | "reasoning"
  | "image-upload"
  | "file-upload"
  | "web-search";

export const MODELS: Model[] = [
  {
    id: DEFAULT_MODEL,
    name: "Auto",
    description:
      "deco.chat will automatically choose the best model for you, based on performance and speed.",
    logo: "",
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
    id: "google:gemini-2.5-pro-preview",
    name: "Google Gemini 2.5 Pro",
    logo: LOGOS.google,
    capabilities: ["reasoning", "image-upload", "file-upload", "web-search"],
    legacyId: "google:gemini-2.5-pro-preview-03-25",
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

export const NEW_INTEGRATION_TEMPLATE: Omit<Integration, "id"> = {
  name: "New Integration",
  description: "A new multi-channel platform integration",
  icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
  connection: { type: "SSE", url: "https://example.com/sse" },
};

export const INNATE_INTEGRATIONS = {
  DECO_AGENTS: {
    id: "DECO_AGENTS",
    name: "Agents",
    description: "Tools for managing agents, integrations, triggers, and more.",
    icon: "https://assets.webdraw.app/uploads/agents.png",
    connection: { type: "INNATE", name: "DECO_AGENTS" },
  },
  DECO_TRIGGER: {
    id: "DECO_TRIGGER",
    name: "Trigger",
    description: "Tools for managing triggers.",
    icon: "https://assets.webdraw.app/uploads/triggers.png",
    connection: { type: "INNATE", name: "DECO_TRIGGER" },
  },
  DECO_INTEGRATIONS: {
    id: "DECO_INTEGRATIONS",
    name: "Integrations",
    description: "Tools for managing integrations.",
    icon: "https://assets.webdraw.app/uploads/integrations.png",
    connection: { type: "INNATE", name: "DECO_INTEGRATIONS" },
  },
  DECO_WALLET: {
    id: "DECO_WALLET",
    name: "Wallet",
    description: "Tools for managing wallets.",
    icon: "https://assets.webdraw.app/uploads/wallet.png",
    connection: { type: "INNATE", name: "DECO_WALLET" },
  },
  DECO_THREADS: {
    id: "DECO_THREADS",
    name: "Threads",
    description: "Tools for managing threads.",
    icon: "https://assets.webdraw.app/uploads/threads.png",
    connection: { type: "INNATE", name: "DECO_THREADS" },
  },
  DECO_UTILS: {
    id: "DECO_UTILS",
    name: "Utils",
    description: "Tools for managing utils.",
    icon: "https://assets.webdraw.app/uploads/utils.png",
    connection: { type: "INNATE", name: "DECO_UTILS" },
  },
} satisfies Record<string, Integration>;

/**
 * TODO: something is weird with the tools set here.
 * There's something off with the innate agents having to have
 * these tools hardcoded in here. Maybe a setup is missing?
 */
export const WELL_KNOWN_AGENTS = {
  teamAgent: {
    id: "teamAgent",
    name: "Deco Chat",
    avatar:
      "https://assets.decocache.com/webdraw/b010a0b9-d576-4d57-9c3a-b86aee1eca1f/explorer.jpeg",
    description: "I can help you with anything you need.",
    model: DEFAULT_MODEL,
    tools_set: {
      DECO_AGENTS: [
        "DECO_AGENTS_CREATE",
        "DECO_AGENTS_CONFIGURATION",
        "DECO_AGENTS_CONFIGURE",
        "DECO_AGENTS_WHO_AM_I",
      ],
      DECO_INTEGRATIONS: [
        "DECO_INTEGRATIONS_SEARCH",
        "DECO_INTEGRATION_INSTALL",
        "DECO_INTEGRATION_ENABLE",
        "DECO_INTEGRATION_DISABLE",
        "DECO_INTEGRATION_LIST_TOOLS",
      ],
      DECO_WALLET: [
        "DECO_WALLET_PRE_AUTHORIZE_TRANSACTION",
      ],
    },
    views: [],
    instructions: `
    <system>
    You are an assistant on a platform designed to help users accomplish their tasks. Your primary objective is to guide users toward completing what they want to do in the simplest and most helpful way possible.
    
    <task_support>
    When a user describes a goal that depends on third-party systems, check the platform's marketplace for relevant integrations. Only suggest installing or enabling tools after getting the user's explicit confirmation. Once tools are installed, use them to identify which capabilities are available and assist the user accordingly.
    </task_support>
    
    <user_goal_handling>
    Users can have two types of goals:
    <one_time_task>When the user wants to do something once, help them complete the task directly. Do not suggest creating an agent unless the user implies the need for reuse.</one_time_task>
    <repeatable_workflow>When the user wants to set up a solution that can be used repeatedly or by others (e.g., sending emails, analyzing data from spreadsheets), propose creating a specialized agent focused on that purpose. Only proceed after receiving explicit confirmation from the user.</repeatable_workflow>
    
    If the user's intent is unclear, default to handling the request as a one-time task.
    NEVER perform actions without the user's explicit permission. Do not write/install/enable/create anything without the user's explicit permission.
    </user_goal_handling>
    
    <user_assumptions>
    Assume users are non-technical and unfamiliar with the tools or systems needed to complete their goals. Avoid technical jargon. Ask simple, clarifying questions before suggesting a solution to ensure it fits the user's actual need.
    </user_assumptions>
    
    <interaction_guidelines>
    Offer only 1–2 options at a time to avoid overwhelming the user. Focus on one clear action at a time and always request explicit confirmation before proceeding.
    </interaction_guidelines>
    
    <user_consent_rule>
    Never perform actions such as installing tools, enabling services, or creating agents without the user's explicit permission. Always ask for confirmation first.
    </user_consent_rule>
    </system>
    `,
  },
  setupAgent: {
    id: "setupAgent",
    name: "Integration configurator",
    avatar: "https://assets.webdraw.app/uploads/capy-5.png",
    description: "I can help you setting up this integration.",
    model: DEFAULT_MODEL,
    tools_set: {
      DECO_INTEGRATIONS: [
        "DECO_INTEGRATIONS_SEARCH",
        "DECO_INTEGRATION_INSTALL",
        "DECO_INTEGRATION_ENABLE",
        "DECO_INTEGRATION_DISABLE",
        "DECO_INTEGRATION_LIST_TOOLS",
      ],
    },
    views: [],
    instructions: `
    <system>
    You are an assistant on a platform designed to help users accomplish their tasks. Your primary objective is to guide users toward completing what they want to do in the simplest and most helpful way possible.
    </system>
    `,
  },
} satisfies Record<string, Agent>;

export const NEW_AGENT_TEMPLATE: Omit<Agent, "id"> = {
  name: "Untitled",
  avatar: "https://assets.webdraw.app/uploads/capy-5.png",
  description:
    "Your AI agent is still a blank slate. Give it a role, a goal, or just a cool name to get started.",
  model: DEFAULT_MODEL,
  tools_set: {
    DECO_AGENTS: [
      "DECO_AGENTS_CONFIGURATION",
      "DECO_AGENTS_CONFIGURE",
      "DECO_AGENTS_WHO_AM_I",
    ],
    DECO_INTEGRATIONS: [
      "DECO_INTEGRATIONS_SEARCH",
      "DECO_INTEGRATION_INSTALL",
      "DECO_INTEGRATION_ENABLE",
      "DECO_INTEGRATION_DISABLE",
      "DECO_INTEGRATION_LIST_TOOLS",
    ],
  },
  views: [],
  instructions: "This agent has not been configured yet.",
  max_steps: 10,
  max_tokens: 4096,
  memory: {
    last_messages: 10,
  },
};
