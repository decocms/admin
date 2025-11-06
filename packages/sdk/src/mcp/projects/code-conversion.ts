/**
 * Utilities for converting between JSON resource definitions and code files
 * Supports views (.tsx), tools (.ts), and workflows (.ts)
 */

export interface ViewResource {
  name: string;
  description: string;
  code: string;
  inputSchema?: Record<string, unknown>;
  importmap?: Record<string, string>;
  icon?: string;
  tags?: string[];
}

export interface ToolResource {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  execute: string;
  dependencies?: Array<{
    integrationId: string;
    toolNames?: string[];
  }>;
}

export interface WorkflowResource {
  name: string;
  description: string;
  steps: Array<{
    def: {
      name: string;
      title?: string;
      description: string;
      inputSchema?: Record<string, unknown>;
      outputSchema?: Record<string, unknown>;
      execute: string;
      dependencies?: Array<{
        integrationId: string;
        toolNames?: string[];
      }>;
    };
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    options?: {
      retries?: {
        limit?: number;
        delay?: number;
        backoff?: "constant" | "linear" | "exponential";
      };
      timeout?: number;
    };
    views?: string[];
  }>;
}

/**
 * Convert a view JSON resource to a .tsx code file
 */
export function viewJsonToCode(view: ViewResource): string {
  const lines: string[] = [];

  // View code first (preserves imports at the top)
  lines.push(view.code);
  lines.push("");
  lines.push("// Metadata exports");

  // Export metadata as constants at the bottom
  lines.push(`export const name = ${JSON.stringify(view.name)};`);
  lines.push(`export const description = ${JSON.stringify(view.description)};`);

  if (view.inputSchema) {
    lines.push(
      `export const inputSchema = ${JSON.stringify(view.inputSchema, null, 2)};`,
    );
  }

  if (view.importmap) {
    lines.push(
      `export const importmap = ${JSON.stringify(view.importmap, null, 2)};`,
    );
  }

  if (view.icon) {
    lines.push(`export const icon = ${JSON.stringify(view.icon)};`);
  }

  if (view.tags && view.tags.length > 0) {
    lines.push(`export const tags = ${JSON.stringify(view.tags)};`);
  }

  return lines.join("\n");
}

/**
 * Convert a .tsx code file back to view JSON resource
 */
export function viewCodeToJson(code: string): ViewResource {
  const view: Partial<ViewResource> = {};

  // Extract exports using regex (now at the bottom)
  const nameMatch = code.match(/export const name = (.+);/);
  const descMatch = code.match(/export const description = (.+);/);
  const inputSchemaMatch = code.match(
    /export const inputSchema = ([\s\S]+?);(?=\n(?:export const |$))/,
  );
  const importmapMatch = code.match(
    /export const importmap = ([\s\S]+?);(?=\n(?:export const |$))/,
  );
  const iconMatch = code.match(/export const icon = (.+);/);
  const tagsMatch = code.match(/export const tags = (.+);/);

  if (!nameMatch || !descMatch) {
    throw new Error(
      "Invalid view file: missing required 'name' or 'description' export",
    );
  }

  view.name = JSON.parse(nameMatch[1]);
  view.description = JSON.parse(descMatch[1]);

  if (inputSchemaMatch) {
    view.inputSchema = JSON.parse(inputSchemaMatch[1]);
  }

  if (importmapMatch) {
    view.importmap = JSON.parse(importmapMatch[1]);
  }

  if (iconMatch) {
    view.icon = JSON.parse(iconMatch[1]);
  }

  if (tagsMatch) {
    view.tags = JSON.parse(tagsMatch[1]);
  }

  // Extract the actual code (everything before the metadata exports marker)
  const metadataMarkerMatch = code.match(/\n\/\/ Metadata exports\n/);
  if (metadataMarkerMatch) {
    view.code = code.slice(0, metadataMarkerMatch.index).trim();
  } else {
    // Fallback: find the first metadata export and take everything before
    const firstExportMatch = code.match(/\nexport const name = /);
    if (firstExportMatch && firstExportMatch.index) {
      view.code = code.slice(0, firstExportMatch.index).trim();
    } else {
      throw new Error("Invalid view file: cannot locate code section");
    }
  }

  if (!view.code) {
    throw new Error("Invalid view file: no code found");
  }

  return view as ViewResource;
}

/**
 * Convert a tool JSON resource to a .ts code file
 */
export function toolJsonToCode(tool: ToolResource): string {
  const lines: string[] = [];

  // Tool execution function first
  lines.push(tool.execute);
  lines.push("");
  lines.push("// Metadata exports");

  // Metadata at the bottom
  lines.push(`export const name = ${JSON.stringify(tool.name)};`);
  lines.push(`export const description = ${JSON.stringify(tool.description)};`);
  lines.push(
    `export const inputSchema = ${JSON.stringify(tool.inputSchema, null, 2)};`,
  );
  lines.push(
    `export const outputSchema = ${JSON.stringify(tool.outputSchema, null, 2)};`,
  );

  if (tool.dependencies && tool.dependencies.length > 0) {
    lines.push(
      `export const dependencies = ${JSON.stringify(tool.dependencies, null, 2)};`,
    );
  }

  return lines.join("\n");
}

/**
 * Convert a .ts code file back to tool JSON resource
 */
export function toolCodeToJson(code: string): ToolResource {
  const tool: Partial<ToolResource> = {};

  const nameMatch = code.match(/export const name = (.+);/);
  const descMatch = code.match(/export const description = (.+);/);
  
  // For multi-line JSON, match until we find the closing delimiter
  // Use a greedy match that stops at }; or ]; followed by newline
  const inputSchemaMatch = code.match(
    /export const inputSchema = ({[\s\S]*?});/,
  );
  const outputSchemaMatch = code.match(
    /export const outputSchema = ({[\s\S]*?});/,
  );
  const dependenciesMatch = code.match(
    /export const dependencies = (\[[\s\S]*?]);/,
  );

  if (!nameMatch || !descMatch || !inputSchemaMatch || !outputSchemaMatch) {
    throw new Error(
      "Invalid tool file: missing required exports (name, description, inputSchema, outputSchema)",
    );
  }

  tool.name = JSON.parse(nameMatch[1]);
  tool.description = JSON.parse(descMatch[1]);
  tool.inputSchema = JSON.parse(inputSchemaMatch[1]);
  tool.outputSchema = JSON.parse(outputSchemaMatch[1]);

  if (dependenciesMatch) {
    tool.dependencies = JSON.parse(dependenciesMatch[1]);
  }

  // Extract execute code (everything before the metadata exports marker)
  const metadataMarkerMatch = code.match(/\n\/\/ Metadata exports\n/);
  if (metadataMarkerMatch) {
    tool.execute = code.slice(0, metadataMarkerMatch.index).trim();
  } else {
    // Fallback: find the first metadata export and take everything before
    const firstExportMatch = code.match(/\nexport const name = /);
    if (firstExportMatch && firstExportMatch.index) {
      tool.execute = code.slice(0, firstExportMatch.index).trim();
    } else {
      throw new Error("Invalid tool file: cannot locate execute code");
    }
  }

  if (!tool.execute) {
    throw new Error("Invalid tool file: no execute code found");
  }

  return tool as ToolResource;
}

/**
 * Convert a workflow JSON resource to a .ts code file
 */
export function workflowJsonToCode(workflow: WorkflowResource): string {
  const lines: string[] = [];

  // Step execution functions first
  lines.push("// Step execution functions");
  workflow.steps.forEach((step, index) => {
    lines.push("");
    lines.push(`// Step: ${step.def.name}`);
    lines.push(`export const step_${index}_execute = ${step.def.execute};`);
  });

  lines.push("");
  lines.push("// Metadata exports");

  // Metadata at the bottom
  lines.push(`export const name = ${JSON.stringify(workflow.name)};`);
  lines.push(
    `export const description = ${JSON.stringify(workflow.description)};`,
  );

  // Export step metadata (without execute code)
  const stepsMetadata = workflow.steps.map((step) => ({
    def: {
      name: step.def.name,
      title: step.def.title,
      description: step.def.description,
      inputSchema: step.def.inputSchema,
      outputSchema: step.def.outputSchema,
      dependencies: step.def.dependencies,
    },
    input: step.input,
    output: step.output,
    options: step.options,
    views: step.views,
  }));

  lines.push(
    `export const stepsMetadata = ${JSON.stringify(stepsMetadata, null, 2)};`,
  );

  return lines.join("\n");
}

/**
 * Convert a .ts code file back to workflow JSON resource
 */
export function workflowCodeToJson(code: string): WorkflowResource {
  const workflow: Partial<WorkflowResource> = {};

  const nameMatch = code.match(/export const name = (.+);/);
  const descMatch = code.match(/export const description = (.+);/);
  const stepsMetadataMatch = code.match(
    /export const stepsMetadata = ([\s\S]+?);(?=\n*$)/,
  );

  if (!nameMatch || !descMatch || !stepsMetadataMatch) {
    throw new Error(
      "Invalid workflow file: missing required exports (name, description, stepsMetadata)",
    );
  }

  workflow.name = JSON.parse(nameMatch[1]);
  workflow.description = JSON.parse(descMatch[1]);
  const stepsMetadata = JSON.parse(stepsMetadataMatch[1]);

  // Extract step execute functions (they're at the top now)
  const stepExecuteMatches = Array.from(
    code.matchAll(
      /export const step_(\d+)_execute = ([\s\S]+?)(?=\n(?:\/\/ Step:|export const step_|\n\/\/ Metadata exports))/g,
    ),
  );

  workflow.steps = stepsMetadata.map(
    (
      stepMeta: {
        def: {
          name: string;
          title?: string;
          description: string;
          inputSchema?: Record<string, unknown>;
          outputSchema?: Record<string, unknown>;
          dependencies?: Array<{
            integrationId: string;
            toolNames?: string[];
          }>;
        };
        input?: Record<string, unknown>;
        output?: Record<string, unknown>;
        options?: {
          retries?: {
            limit?: number;
            delay?: number;
            backoff?: "constant" | "linear" | "exponential";
          };
          timeout?: number;
        };
        views?: string[];
      },
      index: number,
    ) => {
      const executeMatch = stepExecuteMatches.find(
        (match) => Number.parseInt(match[1], 10) === index,
      );

      if (!executeMatch) {
        throw new Error(
          `Invalid workflow file: missing execute function for step ${index}`,
        );
      }

      // Remove trailing semicolon from execute code
      const executeCode = executeMatch[2].trim();
      const cleanExecute = executeCode.endsWith(";")
        ? executeCode.slice(0, -1)
        : executeCode;

      return {
        def: {
          ...stepMeta.def,
          execute: cleanExecute,
        },
        input: stepMeta.input,
        output: stepMeta.output,
        options: stepMeta.options,
        views: stepMeta.views,
      };
    },
  );

  return workflow as WorkflowResource;
}

/**
 * Determine the file extension for a resource type
 */
export function getResourceExtension(
  resourceType: "view" | "tool" | "workflow",
): string {
  switch (resourceType) {
    case "view":
      return ".tsx";
    case "tool":
    case "workflow":
      return ".ts";
  }
}

/**
 * Detect resource type from file extension
 */
export function detectResourceType(
  filePath: string,
): "view" | "tool" | "workflow" | null {
  // Normalize path to handle both /views/ and views/
  const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
  
  if (normalizedPath.includes("/views/") && normalizedPath.endsWith(".tsx")) {
    return "view";
  }
  if (normalizedPath.includes("/tools/") && normalizedPath.endsWith(".ts")) {
    return "tool";
  }
  if (normalizedPath.includes("/workflows/") && normalizedPath.endsWith(".ts")) {
    return "workflow";
  }
  return null;
}

/**
 * Check if a file should be converted (is a code file in a resource directory)
 */
export function shouldConvertToJson(filePath: string): boolean {
  return detectResourceType(filePath) !== null;
}

/**
 * Check if a JSON resource should be converted to code
 */
export function shouldConvertToCode(filePath: string): boolean {
  return (
    (filePath.includes("/views/") ||
      filePath.includes("/tools/") ||
      filePath.includes("/workflows/")) &&
    filePath.endsWith(".json")
  );
}
