/**
 * Server-side posthog utilities
 */

export interface PosthogConfig {
  /**
   * The API key to use for the Posthog server.
   * If not provided, the client will be a mock client that does nothing.
   */
  apiKey?: string;
  /**
   * The API host to use for the Posthog server.
   * If not provided, the client will be a mock client that does nothing.
   */
  apiHost?: string;
}

export type ServerEvent =
  | "agent_init_error"
  | "agent_configure_error"
  | "agent_memory_query_error"
  | "agent_tool_connection_error"
  | "agent_tool_error"
  | "agent_generate_error"
  | "agent_stream_error"
  | "agent_insufficient_funds_error"
  | "agent_mcp_client_error"
  | "trigger_init_error"
  | "trigger_run_error"
  | "trigger_run_success"
  | "trigger_create_error"
  | "trigger_delete_error"
  | "trigger_tool_error"
  | "trigger_data_load_error"
  | "hosting_app_deploy_error";

export type ServerEventProperties = {
  distinctId: string;
  /**
   * Set this to false if you want to treat as anonymous event
   */
  $process_person_profile?: boolean;
} & Record<string, unknown>;

export async function trackServerEvent(
  event: ServerEvent,
  properties: ServerEventProperties,
  config: PosthogConfig,
) {
  try {
    if (!config.apiHost || !config.apiKey) {
      throw new Error("Posthog API key and host are required to track events");
    }

    const url = new URL(config.apiHost);
    url.pathname = "/i/v0/e/";

    const payload = {
      api_key: config.apiKey,
      event,
      distinct_id: properties.distinctId,
      properties: properties,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(url.toString(), {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    await response.body?.cancel().catch(() => {});
    if (!response.ok) {
      throw new Error(
        `Failed to track event: ${response.statusText} ${response.status}`,
      );
    }
  } catch (error) {
    console.error("Failed to track event", error);
  }
}

export function createMockPosthogServerClient(): PosthogServerClient {
  return {
    trackEvent: (_event: ServerEvent, _properties: ServerEventProperties) => {},
  };
}

export type PosthogServerClient = {
  trackEvent: (
    event: ServerEvent,
    properties: ServerEventProperties,
  ) => Promise<void> | void;
};

export function createPosthogServerClient(
  config: PosthogConfig,
): PosthogServerClient {
  // Fallback to mock client if no config is provided, for local development without having
  // the environment variables set.
  if (!config.apiKey || !config.apiHost) {
    return createMockPosthogServerClient();
  }

  const trackEvent = (event: ServerEvent, properties: ServerEventProperties) =>
    trackServerEvent(event, properties, config);

  return {
    trackEvent,
  };
}
