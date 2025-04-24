import type { Agent, Integration } from "@deco/sdk";

export default class App {
  /**
   * @name Deco Chat MCP
   * @description MCP for managing all APIs for deco.chat.
   */
  constructor(
    private readonly SUPABASE_SERVER_TOKEN: string,
    private readonly SUPABASE_URL: string,
  ) {}

  /**
   * @name AGENTS_GET
   * @description Get an agent by id.
   */
  public agent_get(input: { id: string }): Promise<Agent> {
    // TODO: Implement this.
  }

  /**
   * @name AGENTS_CREATE
   * @description Create an agent.
   */
  public agent_create(input: { agent: Partial<Agent> }): Promise<Agent> {
    // TODO: Implement this.
  }

  /**
   * @name AGENTS_UPDATE
   * @description Update an agent.
   */
  public agent_update(
    input: { id: string; agent: Partial<Agent> },
  ): Promise<Agent> {
    // TODO: Implement this.
  }

  /**
   * @name AGENTS_DELETE
   * @description Delete an agent.
   */
  public agent_delete(input: { id: string }): void {
    // TODO: Implement this.
  }

  /**
   * @name INTEGRATIONS_GET
   * @description Get an integration by id.
   */
  public integration_get(input: { id: string }): Promise<Integration> {
    // TODO: Implement this.
  }

  /**
   * @name INTEGRATIONS_CREATE
   * @description Create an integration.
   */
  public integration_create(
    input: { integration: Partial<Integration> },
  ): Promise<Integration> {
    // TODO: Implement this.
  }

  /**
   * @name INTEGRATIONS_UPDATE
   * @description Update an integration.
   */
  public integration_update(
    input: { id: string; integration: Partial<Integration> },
  ): Promise<Integration> {
    // TODO: Implement this.
  }

  /**
   * @name INTEGRATIONS_DELETE
   * @description Delete an integration.
   */
  public integration_delete(input: { id: string }): void {
    // TODO: Implement this.
  }

  /// Other APIs come here...
}
