type WELL_KNOWN_TOOL_GROUPS = typeof WELL_KNOWN_DEFAULT_INTEGRATION_TOOLS_SET;

const WELL_KNOWN_DEFAULT_INTEGRATION_TOOLS_SET = {
  CORE: {
    // FS
    CREATE_DIRECTORY: false,
    DELETE_FILE: false,
    EDIT_FILE: false,
    GET_FILE_INFO: false,
    LIST_DIRECTORY: false,
    READ_MULTIPLE_FILES: false,
    MOVE_FILE: false,
    READ_FILE: false,
    SEARCH_FILES: false,
    WRITE_FILE: false,
    CREATE_PRESIGNED_URL: false,

    // VIEW
    RENDER: false,

    // INTEGRATIONS
    INTEGRATIONS_SEARCH: true,
    INTEGRATION_INSTALL: true,
    INTEGRATION_ENABLE: true,
    INTEGRATION_DISABLE: true,
    INTEGRATION_LIST_TOOLS: false,

    // INNATE:
    AGENT_CREATE: false,
    AGENT_CONFIGURATION: true,
    AGENT_CONFIGURE: false,
    AGENT_WHO_AM_I: false,
    GENERATE: false,
    REFRESH_TOOLS: false,
    FETCH: false,
    POLL_FOR_CONTENT: false,

    // TRIGGERS
    GET_WEBHOOK_TRIGGER_URL: false,
    CREATE_CRON_TRIGGER: false,
    CREATE_WEBHOOK_TRIGGER: false,
    DELETE_TRIGGER: false,
    LIST_TRIGGERS: false,

    // THREADS
    LIST_THREADS: false,
    CREATE_THREAD: false,
  },
};

export const WELL_KNOWN_DEFAULT_INTEGRATION_TOOLS: {
  [key in keyof WELL_KNOWN_TOOL_GROUPS]: Array<
    keyof WELL_KNOWN_TOOL_GROUPS[key]
  >;
} = {
  CORE: Object.keys(WELL_KNOWN_DEFAULT_INTEGRATION_TOOLS_SET.CORE) as Array<
    keyof WELL_KNOWN_TOOL_GROUPS["CORE"]
  >,
};

/**
 * Initial toolset for an agent includes all tools for default integrations,
 * excluding the Filesystem integration.
 */
export const WELL_KNOWN_INITIAL_TOOLS_SET = {
  CORE: [
    ...Object.entries(WELL_KNOWN_DEFAULT_INTEGRATION_TOOLS_SET.CORE)
      .filter(([_, value]) => value)
      .map(([key]) => key),
  ],
};

// Define the type for import.meta.env
interface ImportMetaEnv {
  VITE_USE_LOCAL_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Determines if the application should use local backend services.
 *
 * By default, LOCAL_DEBUGGER will be false.
 * If the environment variable VITE_USE_LOCAL_BACKEND is set to 'true',
 * it will use the localhost version.
 */
// @ts-ignore - Vite injects env variables at build time
const LOCAL_DEBUGGER = import.meta.env.VITE_USE_LOCAL_BACKEND === "true";

// Log a warning if the environment variable is not set
// @ts-ignore - Vite injects env variables at build time
if (import.meta.env.VITE_USE_LOCAL_BACKEND === undefined) {
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
};
