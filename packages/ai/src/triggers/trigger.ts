/* oxlint-disable no-explicit-any */

// NOTE:
// Do not use private class fields or methods prefixed with '#'.
// JavaScript's private syntax (#) is not compatible with Proxy objects,
// as it enforces that 'this' must be the original instance, not a proxy.
// This will cause runtime errors like:
//   TypeError: Receiver must be an instance of class ...
//
// Instead, use a leading underscore (_) to indicate a method or property is private.
// Also, visibility modifiers (like 'private' or 'protected') from TypeScript
// are not enforced at runtime in JavaScript and are not preserved in the transpiled output.
import type { ActorState } from "@deco/actors";
import { Actor } from "@deco/actors";
import { Locator, ProjectLocator } from "@deco/sdk";
import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk/constants";
import { contextStorage } from "@deco/sdk/fetch";
import { Hosts } from "@deco/sdk/hosts";
import {
  type AppContext,
  BindingsContext,
  createResourceAccess,
  fromWorkspaceString,
  MCPClient,
  type MCPClientStub,
  PrincipalExecutionContext,
  type ProjectTools,
  toBindingsContext,
} from "@deco/sdk/mcp";
import type { Callbacks } from "@deco/sdk/mcp/binder";
import type { CallTool } from "@deco/sdk/models";
import type { Json } from "@deco/sdk/storage";
import { getRuntimeKey } from "hono/adapter";
import { AIAgent } from "../agent.ts";
import { isApiDecoChatMCPConnection } from "../mcp.ts";
import { hooks as cron } from "./cron.ts";
import type { TriggerData, TriggerRun } from "./services.ts";
import { hooks as webhook } from "./webhook.ts";
export type { TriggerData };

export const threadOf = (
  data: TriggerData,
  url?: URL,
): { threadId: string | undefined; resourceId: string | undefined } => {
  const resourceId =
    data.resourceId ?? url?.searchParams.get("resourceId") ?? undefined;
  const threadId =
    url?.searchParams.get("threadId") ??
    (resourceId ? crypto.randomUUID() : undefined); // generate a random threadId if resourceId exists.
  return { threadId, resourceId };
};

export interface TriggerHooks<TData extends TriggerData = TriggerData> {
  type: TData["type"];
  onCreated?(data: TData, trigger: Trigger): Promise<void>;
  onDeleted?(data: TData, trigger: Trigger): Promise<void>;
  run(data: TData, trigger: Trigger, args?: unknown): Promise<unknown>;
}

const hooks: Record<TriggerData["type"], TriggerHooks<TriggerData>> = {
  cron,
  webhook,
};

export interface TriggerMetadata {
  params?: Record<string, string>;
  reqHeaders?: Record<string, string>;
  internalCall?: boolean;
}

function mapTriggerToTriggerData(
  trigger: NonNullable<
    Awaited<ReturnType<MCPClientStub<ProjectTools>["TRIGGERS_GET"]>>
  >,
): TriggerData {
  return {
    id: trigger.id,
    resourceId: trigger.user.id,
    createdAt: trigger.createdAt,
    updatedAt: trigger.updatedAt,
    author: {
      id: trigger.user.id,
      name: trigger.user.metadata.full_name,
      email: trigger.user.metadata.email,
      avatar: trigger.user.metadata.avatar_url,
    },
    ...trigger.data,
  } as TriggerData;
}

export interface InvokePayload {
  args: unknown[];
  metadata?: Record<string, unknown>;
}
const buildInvokeUrl = (
  triggerId: string,
  method: keyof Trigger,
  passphrase?: string | null,
  payload?: InvokePayload,
): URL => {
  const invoke = new URL(
    `https://${Hosts.API}/actors/${Trigger.name}/invoke/${method}`,
  );
  invoke.searchParams.set("deno_isolate_instance_id", triggerId);

  if (passphrase) {
    invoke.searchParams.set("passphrase", passphrase);
  }
  if (payload) {
    invoke.searchParams.set(
      "args",
      encodeURIComponent(JSON.stringify(payload)),
    );
  }

  return invoke;
};

@Actor()
export class Trigger {
  public metadata?: TriggerMetadata;
  public mcpClient: MCPClientStub<ProjectTools>;

  protected data: TriggerData | null = null;
  protected hooks: TriggerHooks<TriggerData> | null = null;
  public locator: ProjectLocator;
  protected context: BindingsContext;
  private branch: string = "main"; // TODO(@mcandeia) for now only main branch is supported
  private env: any;

  constructor(
    public state: ActorState,
    protected actorEnv: any,
  ) {
    this.context = toBindingsContext(this.actorEnv);
    this.locator = Locator.asFirstTwoSegmentsOf(this.state.id);

    this.mcpClient = this._createMCPClient();

    state.blockConcurrencyWhile(async () => {
      try {
        const loadedData = await this._loadData();
        if (loadedData) {
          this._setData(loadedData);
        }
      } catch (error) {
        console.error("Error loading data from Supabase:", error);
        this._trackEvent("trigger_init_error", {
          error: error instanceof Error ? error.message : String(error),
          method: "constructor",
        });
      }
    });
  }

  private _trackEvent(event: string, properties: Record<string, unknown> = {}) {
    this.context.posthog.trackEvent(event as any, {
      distinctId: this.state.id,
      $process_person_profile: false,
      actorId: this.state.id,
      actorType: "trigger",
      ...properties,
    });
  }

  public get workspace() {
    return Locator.adaptToRootSlug(this.locator);
  }

  public get agentId(): string {
    // Only certain trigger types have agentId
    if (this.data && "agentId" in this.data) {
      return `/${this.locator}/Agents/${this.data.agentId}`;
    }
    return `/${this.locator}/Agents/${WELL_KNOWN_AGENT_IDS.teamAgent}`;
  }

  private _createContext(): AppContext {
    const workspace = fromWorkspaceString(this.workspace, this.branch);
    const { org, project } = Locator.parse(this.locator);
    const locatorValue = Locator.from({ org, project });
    const principalContext: PrincipalExecutionContext = {
      params: {},
      user: null as unknown as AppContext["user"],
      isLocal: true,
      resourceAccess: createResourceAccess(),
      workspace,
      locator: { org, project, value: locatorValue, branch: this.branch },
    };

    return {
      ...this.context,
      ...principalContext,
    };
  }

  _token() {
    return this.context.jwtIssuer().then((issuer) =>
      issuer.issue({
        sub: `trigger:${this._getTriggerId()}`,
        aud: this.workspace,
      }),
    );
  }

  private _runWithContext<T>(fn: () => Promise<T>) {
    return contextStorage.run(
      {
        env: this.actorEnv,
        ctx: {
          passThroughOnException: () => {},
          waitUntil: () => {},
          props: {},
        },
      },
      fn,
    );
  }

  public _callTool(tool: CallTool, args?: Record<string, unknown>) {
    return this._runWithContext(async () => {
      try {
        const integration = await this.mcpClient.INTEGRATIONS_GET({
          id: tool.integrationId,
        });

        const patchedConnection = isApiDecoChatMCPConnection(
          integration.connection,
        )
          ? { ...integration.connection, token: await this._token() }
          : integration.connection;

        const response = await this.mcpClient.INTEGRATIONS_CALL_TOOL({
          connection: patchedConnection,
          params: {
            name: tool.toolName,
            arguments: tool.arguments ?? args,
          },
        });

        return response;
      } catch (error) {
        console.error("Error calling tool:", error);
        this._trackEvent("trigger_tool_error", {
          error: error instanceof Error ? error.message : String(error),
          toolId: tool.integrationId,
          toolName: tool.toolName,
          method: "_callTool",
        });
        throw error;
      }
    });
  }

  private _createMCPClient() {
    return MCPClient.forContext(this._createContext());
  }

  public _callbacks(payload?: InvokePayload): Callbacks {
    const urlFor = (method: keyof Trigger) =>
      buildInvokeUrl(
        this.state.id,
        method,
        this.metadata?.params?.passphrase,
        payload,
      ).href;

    return {
      stream: urlFor("stream"),
      generate: urlFor("generate"),
      generateObject: urlFor("generateObject"),
    };
  }

  private async _loadFromState() {
    return await this.state.storage.get<TriggerData | null>("triggerData");
  }
  private async _saveToState(data: TriggerData) {
    await this.state.storage.put("triggerData", data);
  }

  private async _loadData(): Promise<TriggerData | null> {
    try {
      const loadFromDbPromise = this.mcpClient
        .TRIGGERS_GET({
          id: this._getTriggerId(),
        })
        .then((v) => (v === null ? null : mapTriggerToTriggerData(v)))
        .catch((error) => {
          console.error("Error loading trigger from DB:", error);
          this._trackEvent("trigger_data_load_error", {
            error: error instanceof Error ? error.message : String(error),
            source: "database",
            triggerId: this._getTriggerId(),
          });
          return null;
        });

      const loadFromStatePromise = this._loadFromState()
        .then((v) => (v === null ? loadFromDbPromise : v))
        .catch((error) => {
          console.error("Error loading trigger from state:", error);
          this._trackEvent("trigger_data_load_error", {
            error: error instanceof Error ? error.message : String(error),
            source: "state",
            triggerId: this._getTriggerId(),
          });
          return null;
        });

      // loads in parallel and get faster
      const triggerData = await Promise.race([
        loadFromDbPromise,
        loadFromStatePromise,
      ]);

      if (!triggerData) {
        // if faster is null so we try to load from db and state
        return Promise.all([loadFromDbPromise, loadFromStatePromise]).then(
          ([fromDb, fromState]) => fromDb ?? fromState,
        );
      }

      return triggerData;
    } catch (error) {
      console.error("Error in _loadData:", error);
      this._trackEvent("trigger_data_load_error", {
        error: error instanceof Error ? error.message : String(error),
        source: "general",
        triggerId: this._getTriggerId(),
      });
      throw error;
    }
  }

  private _setData(data: TriggerData) {
    this.data = data;
    this.hooks = this.data ? hooks[this.data?.type ?? "cron"] : cron;
  }

  private _getTriggerId() {
    return this.state.id.split("/").at(-1) || "";
  }

  private async _saveRun(run: Omit<TriggerRun, "id" | "timestamp">) {
    await this.context.db
      .from("deco_chat_trigger_runs")
      .insert({
        trigger_id: run.triggerId,
        result: run.result as Json,
        metadata: run.metadata as Json,
        status: run.status,
      })
      .select("*")
      .single();
  }

  _assertsValidInvoke() {
    if (!this.data) {
      throw new Error("Trigger does not have a data");
    }
    if (!("passphrase" in this.data)) {
      return;
    }
    if (this.data.passphrase !== this.metadata?.params?.passphrase) {
      throw new Error("Invalid passphrase");
    }
  }

  /**
   * Public method section all methods starting from here are publicly accessible
   */

  // PUBLIC METHODS

  enrichMetadata(metadata: TriggerMetadata, req: Request): TriggerMetadata {
    return {
      internalCall:
        req.headers.get("host") === null || getRuntimeKey() === "deno",
      params: Object.fromEntries(new URL(req.url).searchParams.entries()),
      reqHeaders: Object.fromEntries(req.headers.entries()),
      ...metadata,
    };
  }

  async run(args?: unknown, options?: Record<string, string>) {
    const runData: Record<string, unknown> = {};
    try {
      const data = this.data;
      runData.data = data;
      runData.metadata = this.metadata;

      if (this.metadata) {
        this.metadata.params = options ?? this.metadata.params;
      }

      if (!data) {
        return;
      }

      runData.result = await this.hooks?.run(data, this, args);
      return runData.result;
    } catch (error) {
      console.error("Error running trigger:", error);
      runData.error = JSON.stringify(error);
    } finally {
      await this._saveRun({
        triggerId: this._getTriggerId(),
        result: runData.result as Record<string, unknown> | null,
        status: runData.error ? "error" : "success",
        metadata: {
          ...(runData.metadata as Record<string, unknown> | null),
          args,
          error: runData.error,
        },
      });
    }
  }

  async alarm() {
    await this.run();
  }

  generateObject(...args: Parameters<AIAgent["generateObject"]>) {
    this._assertsValidInvoke();
    const stub = this.state.stub(AIAgent).new(`${this.agentId}`);
    return stub.generateObject(...args);
  }

  stream(...args: Parameters<AIAgent["stream"]>) {
    this._assertsValidInvoke();
    const stub = this.state.stub(AIAgent).new(`${this.agentId}`);
    return stub.stream(...args);
  }

  generate(...args: Parameters<AIAgent["generate"]>) {
    this._assertsValidInvoke();
    const stub = this.state.stub(AIAgent).new(`${this.agentId}`);
    return stub.generate(...args);
  }

  async create(
    data: TriggerData,
  ): Promise<
    { ok: false; message: string } | { ok: true; callbacks: Callbacks }
  > {
    if (this.metadata?.internalCall === false) {
      return {
        ok: false,
        message: "Trigger is not allowed to be created from external sources",
      };
    }

    try {
      this._setData(data);
      await this._saveToState(data);
      await this.hooks?.onCreated?.(data, this);

      return {
        ok: true,
        callbacks: this._callbacks(),
      };
    } catch (error) {
      console.error("Error creating trigger in Supabase:", error);
      this._trackEvent("trigger_create_error", {
        error: error instanceof Error ? error.message : String(error),
        triggerId: this._getTriggerId(),
        triggerType: data.type,
      });
      return {
        ok: false,
        message: `Failed to create trigger in Supabase: ${error}`,
      };
    }
  }

  async delete() {
    if (this.metadata?.internalCall === false) {
      return {
        success: false,
        message: "Trigger is not allowed to be deleted from external sources",
      };
    }
    if (!this.data) {
      return {
        success: true,
      };
    }

    try {
      await this.hooks?.onDeleted?.(this.data, this);

      this.data = null;

      return {
        success: true,
        message: "Trigger deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting trigger:", error);
      this._trackEvent("trigger_delete_error", {
        error: error instanceof Error ? error.message : String(error),
        triggerId: this._getTriggerId(),
        triggerType: this.data?.type,
      });
      return {
        success: false,
        message: `Failed to delete trigger: ${error}`,
      };
    }
  }
}
