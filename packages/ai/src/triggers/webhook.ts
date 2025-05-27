import { AIAgent } from "../agent.ts";
import type { Message, StreamOptions } from "../types.ts";
import { getWorkspaceFromAgentId } from "../utils/workspace.ts";
import { handleOutputTool } from "./outputTool.ts";
import type { TriggerData } from "./services.ts";
import { threadOf } from "./tools.ts";
import { type TriggerHooks } from "./trigger.ts";

export interface WebhookArgs {
  threadId?: string;
  resourceId?: string;
  messages: Message[];
}

const isAIMessage = (m: unknown | Message): m is Message => {
  return typeof m === "object" && m !== null && "role" in m &&
    ("content" in m || "audioBase64" in m) &&
    "id" in m && typeof m.id === "string" && typeof m.role === "string";
};

const isAIMessages = (m: unknown | Message[]): m is Message[] => {
  return Array.isArray(m) && m.every(isAIMessage);
};

const parseOptions: {
  [key in keyof StreamOptions]?: (
    val: string | null | undefined,
  ) => StreamOptions[key];
} = {
  bypassOpenRouter: (val) => val === "true",
  lastMessages: (val) => val ? parseInt(val) : undefined,
  sendReasoning: (val) => val === "true",
};

export const hooks: TriggerHooks<TriggerData & { type: "webhook" }> = {
  type: "webhook",
  run: async (data, trigger, args) => {
    if (data.passphrase && data.passphrase !== trigger.metadata?.passphrase) {
      return {
        error: "Invalid passphrase",
      };
    }
    const url = trigger.metadata?.reqUrl
      ? new URL(trigger.metadata.reqUrl)
      : undefined;
    const inputBinding = trigger.inputBinding;
    if (inputBinding) {
      const result = await inputBinding.ON_AGENT_INPUT({
        callbacks: trigger._callbacks(),
        payload: args,
        url: trigger.metadata?.reqUrl ?? undefined,
        headers: trigger.metadata?.reqHeaders,
      });
      // deno-lint-ignore no-explicit-any
      const structuredContent: any = result?.structuredContent;
      if (
        typeof structuredContent === "object" && structuredContent !== null &&
        "status" in structuredContent &&
        typeof structuredContent.status === "number"
      ) {
        const [payload, contentType] = "message" in structuredContent
          ? [structuredContent.message, "text/plain"]
          : [JSON.stringify(structuredContent), "application/json"];

        return new Response(payload, {
          status: structuredContent.status,
          headers: {
            "Content-Type": contentType,
          },
        });
      }
      return result;
    }

    const useStream = url?.searchParams.get("stream") === "true";
    const options: StreamOptions = {};

    for (const _key in parseOptions) {
      const key = _key as keyof typeof parseOptions;
      const val = url?.searchParams.get(key);
      const parser = parseOptions[key];
      if (val && key && parser) {
        // deno-lint-ignore no-explicit-any
        options[key] = parser(val) as any;
      }
    }
    const { threadId, resourceId } = threadOf(data, url);

    const agent = trigger.state
      .stub(AIAgent)
      .new(trigger.agentId)
      .withMetadata({
        threadId: threadId ?? undefined,
        resourceId: resourceId ?? data.id ?? undefined,
      });

    const messagesFromArgs = args && typeof args === "object" &&
        "messages" in args && isAIMessages(args.messages)
      ? args.messages
      : undefined;

    const messages = messagesFromArgs ?? [
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: `the webhook is triggered with the following messages:`,
      },
      ...(args
        ? [
          {
            id: crypto.randomUUID(),
            role: "user" as const,
            content: `\`\`\`json\n${JSON.stringify(args)}\`\`\``,
          },
        ]
        : []),
    ];

    const outputTool = url?.searchParams.get("outputTool");
    if (outputTool) {
      const workspace = getWorkspaceFromAgentId(trigger.agentId);
      return handleOutputTool({
        outputTool,
        agent,
        messages,
        trigger,
        workspace,
      });
    }

    if (
      data.schema ||
      (typeof args === "object" &&
        args !== null &&
        "schema" in args &&
        typeof args.schema === "object")
    ) {
      // deno-lint-ignore no-explicit-any
      const schema = data.schema || (args as { schema: any }).schema;
      try {
        const result = await agent
          .generateObject(messages, schema)
          .then((r) => r.object);
        return result;
      } catch (error) {
        throw error;
      }
    }
    return useStream
      ? await agent.stream(messages, options)
      : await agent.generate(messages, options);
  },
};
