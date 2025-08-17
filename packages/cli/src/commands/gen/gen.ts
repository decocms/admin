// deno-lint-ignore-file no-explicit-any
import { compile } from "json-schema-to-typescript";
import { generateName } from "json-schema-to-typescript/dist/src/utils.js";
import type { DecoBinding } from "../../lib/config.js";
import { createWorkspaceClient } from "../../lib/mcp.js";
import { parser as scopeParser } from "../../lib/parse-binding-tool.js";
import prettier from "prettier";

interface Options {
  workspace: string;
  local?: boolean;
  bindings: DecoBinding[];
  selfUrl?: string;
}

const toValidProperty = (property: string) => {
  return isValidJavaScriptPropertyName(property) ? property : `["${property}"]`;
};

// Sanitize description for safe use in JSDoc block comments
const formatDescription = (desc: string | undefined) => {
  if (!desc) return "";

  return (
    desc
      // Escape */ sequences that would break the comment block
      .replace(/\*\//g, "*\\/")
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Split into lines and format each line
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ` * ${line}`)
      .join("\n")
  );
};

function slugify(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function format(content: string): Promise<string> {
  try {
    return prettier.format(content, {
      parser: "babel-ts",
      plugins: [],
    });
  } catch {
    // Fallback to unformatted content
    return Promise.resolve(content);
  }
}

// Shared list of reserved JavaScript keywords
const RESERVED_KEYWORDS = [
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "enum",
  "await",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "abstract",
  "boolean",
  "byte",
  "char",
  "double",
  "final",
  "float",
  "goto",
  "int",
  "long",
  "native",
  "short",
  "synchronized",
  "throws",
  "transient",
  "volatile",
  "null",
  "true",
  "false",
  "undefined",
  "NaN",
  "Infinity",
];

function isValidJavaScriptPropertyName(name: string): boolean {
  // Check if it's a valid JavaScript identifier
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  if (!validIdentifierRegex.test(name)) {
    return false;
  }

  // Check for reserved keywords
  return !RESERVED_KEYWORDS.includes(name);
}

type KeyInfo = { type: string; key: string };

const DEFAULT_BINDINGS: DecoBinding[] = [
  {
    name: "DECO_CHAT_WORKSPACE_API",
    integration_id: "i:workspace-management",
    type: "mcp",
  },
  {
    name: "DECO_CHAT_API",
    integration_id: "i:user-management",
    type: "mcp",
  },
];

type MCPResult<T> =
  | T
  | {
      isError: true;
      content?: {
        type: "text";
        text: string;
      }[];
    };

const unwrapMcpResult = <T extends object>(
  result: MCPResult<T>,
  opts?: {
    errorMessage?: (error: unknown) => string;
  },
): T => {
  if ("isError" in result && result.isError) {
    const message =
      (Array.isArray(result.content) ? result.content[0]?.text : undefined) ??
      JSON.stringify(result);
    throw new Error(opts?.errorMessage?.(message) ?? message);
  }
  return result as T;
};

export const genEnv = async ({
  workspace,
  local,
  bindings,
  selfUrl,
}: Options) => {
  console.log(
    `🛠️ genEnv start (workspace=${workspace ?? "none"}, local=${!!local}, selfUrl=${selfUrl ?? "none"})`,
  );
  const client = await createWorkspaceClient({ workspace, local });
  const apiClient = await createWorkspaceClient({ local });

  try {
    const types = new Map<string, number>();
    types.set("Env", 1); // set the default env type
    let tsTypes = "";
    const mapBindingTools: Record<string, string[]> = {};
    // Determine effective bindings: if only generating SELF types and no explicit bindings provided, skip DEFAULT_BINDINGS to avoid auth/API calls.
    const effectiveBindings: DecoBinding[] = [
      ...bindings,
      ...((!bindings || bindings.length === 0) && selfUrl
        ? []
        : DEFAULT_BINDINGS),
    ];
    if (selfUrl) {
      effectiveBindings.push({
        name: "SELF",
        type: "mcp" as const,
        integration_url: selfUrl,
        ignoreCache: true,
      } as any);
    }
    console.log(
      `🔧 Effective bindings: ${effectiveBindings.map((b) => (b as any).name || "unknown").join(", ")}`,
    );

    const props = await Promise.all(
      effectiveBindings.map(async (binding) => {
        let connection: unknown;
        let stateKey: KeyInfo | undefined;
        if ("integration_id" in binding) {
          const integrationResult = (await client.callTool({
            name: "INTEGRATIONS_GET",
            arguments: {
              id: binding.integration_id,
            },
          })) as MCPResult<{ structuredContent: { connection: unknown } }>;
          const integration = unwrapMcpResult(integrationResult, {
            errorMessage: (error) =>
              `Error getting integration ${binding.integration_id}: ${error}`,
          });
          connection = integration.structuredContent.connection;
        } else if ("integration_name" in binding) {
          stateKey = { type: binding.integration_name, key: binding.name };
          const appResult = (await client.callTool({
            name: "REGISTRY_GET_APP",
            arguments: {
              name: binding.integration_name,
            },
          })) as MCPResult<{ structuredContent: { connection: unknown } }>;
          const app = unwrapMcpResult(appResult, {
            errorMessage: (error) =>
              `Error getting app ${binding.integration_name}: ${error}`,
          });
          connection = app.structuredContent.connection;
        } else if ("integration_url" in binding) {
          connection = {
            type: "HTTP",
            url: (binding as any).integration_url,
          } as any;
        } else {
          throw new Error(`Unknown binding type: ${binding}`);
        }

        let tools: {
          structuredContent: {
            tools?: {
              name: string;
              inputSchema: any;
              outputSchema?: any;
              description?: string;
            }[];
          };
        };
        try {
          tools = (await apiClient.callTool({
            name: "INTEGRATIONS_LIST_TOOLS",
            arguments: {
              connection,
              ignoreCache:
                "ignoreCache" in binding ? binding.ignoreCache : undefined,
            },
          })) as any;
        } catch (err) {
          console.warn(
            `⚠️ INTEGRATIONS_LIST_TOOLS error for ${binding.name}: ${(err as Error).message}`,
          );
          tools = { structuredContent: { tools: [] } };
        }

        const integrationUrl = (binding as any).integration_url as
          | string
          | undefined;
        const shouldAttemptHttpFallback =
          typeof integrationUrl === "string" &&
          (integrationUrl.startsWith("http://") ||
            integrationUrl.startsWith("https://"));

        if (shouldAttemptHttpFallback) {
          console.log(
            `🔎 Attempting HTTP fallback for integration ${binding.name} ...`,
          );
        }

        if (
          shouldAttemptHttpFallback &&
          (!tools.structuredContent?.tools ||
            tools.structuredContent.tools.length === 0)
        ) {
          try {
            const url = new URL("/mcp/tools", integrationUrl!);
            console.log(
              `🌐 Fetching ${url.toString()} for fallback tool listing`,
            );
            const resp = await fetch(url.toString(), {
              headers: { Accept: "application/json" },
            });
            if (!resp.ok) {
              console.warn(
                `⚠️ Fallback /mcp/tools HTTP ${resp.status} for ${binding.name}`,
              );
            } else {
              const json: any = await resp.json().catch(() => ({}));
              if (
                json &&
                Array.isArray((json as any).tools) &&
                (json as any).tools.length > 0
              ) {
                tools.structuredContent.tools = (json as any).tools.map(
                  (t: any) => ({
                    name: t.name,
                    inputSchema: t.inputSchema ?? t.input_schema ?? {},
                    outputSchema: t.outputSchema ?? t.output_schema,
                    description: t.description,
                  }),
                );
                const count = tools.structuredContent.tools?.length ?? 0;
                console.log(
                  `✅ HTTP fallback loaded ${count} tools for integration ${binding.name}.`,
                );
              } else {
                console.warn(
                  `⚠️ HTTP fallback returned no tools array for ${binding.name}`,
                );
              }
            }
          } catch (e) {
            console.warn(
              `⚠️ Fallback fetch failed for ${binding.name}: ${(e as Error).message}`,
            );
          }
        }

        if (
          !tools.structuredContent?.tools ||
          tools.structuredContent.tools.length === 0
        ) {
          console.warn(
            `⚠️ No tools found for integration ${binding.name}. Skipping...`,
          );
          // Provide a stub so output file is not fully empty for diagnostics
          if (binding.name === "SELF") {
            tsTypes += `\n// No tools discovered for SELF (${(binding as any).integration_url})\n`;
          }
          return null;
        }

        if ("integration_name" in binding) {
          mapBindingTools[binding.name] = tools.structuredContent.tools.map(
            (t) => t.name,
          );
        }

        const compiledTools = await Promise.all(
          tools.structuredContent.tools.map(async (t) => {
            const jsName = generateName(t.name, new Set());
            const inputName = `${jsName}Input`;
            const outputName = `${jsName}Output`;
            const customName = (schema: any) => {
              let typeName = schema.title ?? schema.type;
              if (Array.isArray(typeName)) {
                typeName = typeName.join(",");
              }

              if (typeof typeName !== "string") {
                return undefined;
              }
              const key = slugify(typeName);
              const count = types.get(key) ?? 0;
              types.set(key, count + 1);
              return count ? `${typeName}_${count}` : typeName;
            };
            const [inputTs, outputTs] = await Promise.all([
              compile({ ...t.inputSchema, title: inputName }, inputName, {
                additionalProperties: false,
                customName,
                format: false,
              }),
              t.outputSchema
                ? await compile(
                    { ...t.outputSchema, title: outputName },
                    outputName,
                    {
                      customName,
                      additionalProperties: false,
                      format: false,
                    },
                  )
                : undefined,
            ]);
            tsTypes += `
        ${inputTs}
        ${outputTs ?? ""}
          `;
            return [
              t.name,
              inputName,
              outputTs ? outputName : undefined,
              t.description,
            ];
          }),
        );

        return [binding.name, compiledTools, stateKey] as [
          string,
          [string, string, string | undefined, string | undefined][],
          KeyInfo | undefined,
        ];
      }),
    );

    const generated = await format(`
  // Generated types - do not edit manually
${tsTypes}
   
  import { z } from "zod";

  export type Mcp<T extends Record<string, (input: any) => Promise<any>>> = {
    [K in keyof T]: ((input: Parameters<T[K]>[0]) => Promise<ReturnType<T[K]>>) & {
      asTool: () => Promise<{
        inputSchema: z.ZodType<Parameters<T[K]>[0]>
        outputSchema?: z.ZodType<ReturnType<T[K]>>
        description: string
        id: string
        execute: ({ context }: { context: Parameters<T[K]>[0] }) => Promise<ReturnType<T[K]>>
      }>
    }
  }

  export const StateSchema = z.object({
    ${props
      .filter((p) => p !== null && p[2] !== undefined)
      .map((prop) => {
        const [_, __, stateKey] = prop as [
          string,
          [string, string, string | undefined, string | undefined][],
          KeyInfo | undefined,
        ];
        return `${stateKey!.key}: z.object({
        value: z.string(),
        __type: z.literal("${stateKey!.type}").default("${stateKey!.type}"),
      })`;
      })
      .join(",\n")}
  })

  export interface Env {
    DECO_CHAT_WORKSPACE: string;
    DECO_CHAT_API_JWT_PUBLIC_KEY: string;
    ${props
      .filter((p) => p !== null)
      .map(([propName, tools]) => {
        return `${propName}: Mcp<{
        ${tools
          .map(([toolName, inputName, outputName, description]) => {
            const docComment = description
              ? `/**\n${formatDescription(description)}\n */`
              : "";

            return `${docComment}
          ${toValidProperty(
            toolName,
          )}: (input: ${inputName}) => Promise<${outputName ?? "any"}>;
          `;
          })
          .join("")}
      }>;`;
      })
      .join("")}
  }

  export const Scopes = {
    ${Object.entries(mapBindingTools)
      .map(
        ([bindingName, tools]) =>
          `${toValidProperty(bindingName)}: {
      ${tools
        .map(
          (toolName) =>
            `${toValidProperty(toolName)}: "${scopeParser.fromBindingToolToScope(
              { bindingName, toolName },
            )}"`,
        )
        .join(",\n")}
    }`,
      )
      .join(",\n")}
  }
  `);
    if (!tsTypes.trim()) {
      // Ensure file not empty for diagnostics when no tools
      return (
        "// Generated types (empty) - no tools discovered for provided bindings\n" +
        generated
      );
    }
    return generated;
  } finally {
    // Clean up the client connections
    await client.close();
    await apiClient.close();
  }
};
