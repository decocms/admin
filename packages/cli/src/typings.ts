// deno-lint-ignore-file no-explicit-any
import { compile } from "json-schema-to-typescript";
import type { DecoBinding } from "./config.ts";
import { createWorkspaceClient } from "./mcp.ts";
interface Options {
  workspace: string;
  local?: boolean;
  bindings: DecoBinding[];
}

function slugify(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

/**
 * format content based on deno fmt
 * @param content the string content
 * @returns the formatted content
 */
export async function format(content: string): Promise<string> {
  const fmt = new Deno.Command(Deno.execPath(), {
    args: ["fmt", "-"],
    stdin: "piped",
    stdout: "piped",
    stderr: "null",
  });

  const proc = fmt.spawn();

  const raw = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });

  await raw.pipeTo(proc.stdin);
  const out = await proc.output();
  await proc.status;

  return new TextDecoder().decode(out.stdout);
}

function isValidJavaScriptPropertyName(name: string): boolean {
  // Check if it's a valid JavaScript identifier
  // Must start with letter, underscore, or dollar sign
  // Can contain letters, digits, underscores, or dollar signs
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  if (!validIdentifierRegex.test(name)) {
    return false;
  }

  // Check for reserved keywords
  const reservedKeywords = [
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

  return !reservedKeywords.includes(name);
}
const DEFAULT_BINDINGS: DecoBinding[] = [{
  name: "DECO_CHAT_WORKSPACE_API",
  integration_id: "i:workspace-management",
  type: "mcp",
}, {
  name: "DECO_CHAT_API",
  integration_id: "i:user-management",
  type: "mcp",
}];
export const genEnv = async ({ workspace, local, bindings }: Options) => {
  const client = await createWorkspaceClient({ workspace, local });
  const apiClient = await createWorkspaceClient({ local });

  const types = new Map<string, number>();
  let tsTypes = "";
  const props = await Promise.all(
    [...bindings, ...DEFAULT_BINDINGS].map(async (binding) => {
      const integration = await client.callTool({
        name: "INTEGRATIONS_GET",
        arguments: {
          id: binding.integration_id,
        },
      }) as { structuredContent: { connection: unknown } };
      const tools = await apiClient.callTool({
        name: "INTEGRATIONS_LIST_TOOLS",
        arguments: {
          connection: integration.structuredContent.connection,
        },
      }) as {
        structuredContent: {
          tools: { name: string; inputSchema: any; outputSchema?: any }[];
        };
      };

      if (!Array.isArray(tools.structuredContent?.tools)) {
        console.warn(
          `⚠️ No tools found for integration ${binding.name}. Skipping...`,
        );
        return null;
      }

      const compiledTools = await Promise.all(
        tools.structuredContent.tools
          .filter((t) => isValidJavaScriptPropertyName(t.name))
          .map(async (t) => {
            const inputName = `${t.name}Input`;
            const outputName = `${t.name}Output`;
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
            ];
          }),
      );
      return [
        binding.name,
        compiledTools,
        // propName, toolName, inputType, outputType
      ] as [string, [string, string, string | undefined][]];
    }),
  );

  return await format(`
    // deno-lint-ignore-file no-empty-interface
${tsTypes}
  export interface Env {
    DECO_CHAT_WORKSPACE: string;
    ${
    props.filter((p) => p !== null).map(([propName, tools]) => {
      return `${propName}: {
        ${
        tools.map(([toolName, inputName, outputName]) => {
          return `
          ${toolName}: (input: ${inputName}) => Promise<${outputName ?? "any"}>;
          `;
        }).join("")
      }
      };`;
    }).join("")
  }
  }
  `);
};
