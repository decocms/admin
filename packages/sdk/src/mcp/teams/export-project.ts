import JSZip from "jszip";
import { sanitizeProjectPath } from "../projects/file-utils.ts";
import { createManifest, type Manifest } from "../projects/manifest.ts";
import {
  viewJsonToCode,
  toolJsonToCode,
  workflowJsonToCode,
  type ViewResource,
  type ToolResource,
  type WorkflowResource,
} from "../projects/code-conversion.ts";

interface DeconfigReadResponse {
  content?: string | { base64: string } | unknown;
}

interface ProcessFileContentParams {
  filePath: string;
  readResponse: DeconfigReadResponse;
}

interface ProcessFileContentResult {
  contentStr: string;
}

export function processFileContent(
  params: ProcessFileContentParams,
): ProcessFileContentResult {
  const { readResponse } = params;

  let contentStr: string;

  if (!readResponse.content) {
    contentStr = "";
  } else if (typeof readResponse.content === "string") {
    // Check if it's base64 encoded (common for deconfig)
    if (readResponse.content.match(/^[A-Za-z0-9+/=]+$/)) {
      try {
        contentStr = Buffer.from(readResponse.content, "base64").toString(
          "utf-8",
        );
      } catch {
        // If base64 decode fails, use as-is
        contentStr = readResponse.content;
      }
    } else {
      contentStr = readResponse.content;
    }
  } else if (
    typeof readResponse.content === "object" &&
    "base64" in readResponse.content &&
    typeof readResponse.content.base64 === "string"
  ) {
    contentStr = Buffer.from(readResponse.content.base64, "base64").toString(
      "utf-8",
    );
  } else {
    contentStr = JSON.stringify(readResponse.content);
  }

  return { contentStr };
}

interface ConvertJsonToCodeParams {
  filePath: string;
  contentStr: string;
}

interface ConvertJsonToCodeResult {
  finalContent: string;
  finalPath: string;
  converted: boolean;
}

export function convertJsonToCode(
  params: ConvertJsonToCodeParams,
): ConvertJsonToCodeResult {
  const { filePath, contentStr } = params;

  if (!filePath.endsWith(".json")) {
    return {
      finalContent: contentStr,
      finalPath: filePath,
      converted: false,
    };
  }

  try {
    const parsed = JSON.parse(contentStr);

    if (filePath.startsWith("/src/views/")) {
      const viewResource = parsed as ViewResource;
      const code = viewJsonToCode(viewResource);
      const newPath = filePath.replace(/\.json$/, ".tsx");
      return {
        finalContent: code,
        finalPath: newPath,
        converted: true,
      };
    }

    if (filePath.startsWith("/src/tools/")) {
      const toolResource = parsed as ToolResource;
      const code = toolJsonToCode(toolResource);
      const newPath = filePath.replace(/\.json$/, ".ts");
      return {
        finalContent: code,
        finalPath: newPath,
        converted: true,
      };
    }

    if (filePath.startsWith("/src/workflows/")) {
      const workflowResource = parsed as WorkflowResource;
      const code = workflowJsonToCode(workflowResource);
      const newPath = filePath.replace(/\.json$/, ".ts");
      return {
        finalContent: code,
        finalPath: newPath,
        converted: true,
      };
    }

    return {
      finalContent: contentStr,
      finalPath: filePath,
      converted: false,
    };
  } catch {
    // Fall back to original content on conversion error
    return {
      finalContent: contentStr,
      finalPath: filePath,
      converted: false,
    };
  }
}

interface PrepareFileForZipParams {
  filePath: string;
  contentStr: string;
}

interface PrepareFileForZipResult {
  relativePath: string;
  finalContent: string;
  finalPath: string;
  shouldInclude: boolean;
}

export function prepareFileForZip(
  params: PrepareFileForZipParams,
): PrepareFileForZipResult {
  const { filePath, contentStr } = params;

  // Remove /src/ prefix for cleaner structure
  let relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

  if (relativePath.startsWith("src/")) {
    relativePath = relativePath.slice(4);
  }

  const sanitizedRelativePath = sanitizeProjectPath(relativePath);
  if (!sanitizedRelativePath) {
    return {
      relativePath: "",
      finalContent: "",
      finalPath: "",
      shouldInclude: false,
    };
  }

  // Convert JSON resources to code files
  const conversionResult = convertJsonToCode({
    filePath,
    contentStr,
  });

  // Update the relative path based on conversion
  let finalRelativePath = sanitizedRelativePath;
  if (conversionResult.converted) {
    const extension = conversionResult.finalPath.endsWith(".tsx")
      ? ".tsx"
      : ".ts";
    finalRelativePath = sanitizedRelativePath.replace(/\.json$/, extension);
  }

  return {
    relativePath: finalRelativePath,
    finalContent: conversionResult.finalContent,
    finalPath: conversionResult.finalPath,
    shouldInclude: true,
  };
}

interface ExportAgentParams {
  agent: {
    name: string;
    avatar: string | null;
    instructions: string | null;
    description: string | null;
    tools_set: unknown;
    max_steps: number | null;
    max_tokens: number | null;
    model: string | null;
    memory: unknown;
    views: unknown;
    visibility: "PUBLIC" | "WORKSPACE" | "PRIVATE" | null;
    temperature: number | null;
  };
}

interface ExportAgentResult {
  filename: string;
  content: string;
}

export function exportAgent(params: ExportAgentParams): ExportAgentResult {
  const { agent } = params;

  const exportAgent = {
    name: agent.name,
    avatar: agent.avatar,
    instructions: agent.instructions,
    description: agent.description,
    tools_set: agent.tools_set,
    max_steps: agent.max_steps,
    max_tokens: agent.max_tokens,
    model: agent.model,
    memory: agent.memory,
    views: agent.views,
    visibility: agent.visibility,
    temperature: agent.temperature,
  };

  const safeFilename = agent.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    filename: `${safeFilename}.json`,
    content: JSON.stringify(exportAgent, null, 2) + "\n",
  };
}

interface DatabaseQueryResult {
  result?: unknown[] | { results?: Array<Record<string, unknown>> }[];
}

interface ProcessDatabaseSchemaParams {
  schemaResponse: DatabaseQueryResult;
}

interface DatabaseTable {
  tableName: string;
  createSql: string;
  indexes: Array<{ name: string; sql: string }>;
}

interface ProcessDatabaseSchemaResult {
  tables: DatabaseTable[];
}

export function processDatabaseSchema(
  params: ProcessDatabaseSchemaParams,
): ProcessDatabaseSchemaResult {
  const { schemaResponse } = params;

  const result = schemaResponse.result ?? [];

  // Handle both array of results and single result formats
  const statements = Array.isArray(result) ? result : [result];

  const rows = statements.flatMap((statement) => {
    if (statement && typeof statement === "object" && "results" in statement) {
      return Array.isArray(statement.results) ? statement.results : [];
    }
    return [];
  });

  const tables = rows
    .map((row) => ({
      type: String(row.type ?? ""),
      name: String(row.name ?? ""),
      tableName: String(row.tbl_name ?? row.name ?? ""),
      sql: String(row.sql ?? ""),
    }))
    .filter(
      (entry) =>
        entry.type.toLowerCase() === "table" &&
        entry.name &&
        entry.sql &&
        !entry.name.startsWith("sqlite_") &&
        !entry.name.startsWith("mastra_") &&
        entry.sql.trim().toLowerCase().startsWith("create table"),
    );

  const indexes = rows
    .map((row) => ({
      type: String(row.type ?? ""),
      name: String(row.name ?? ""),
      tableName: String(row.tbl_name ?? ""),
      sql: String(row.sql ?? ""),
    }))
    .filter(
      (entry) =>
        entry.type.toLowerCase() === "index" &&
        entry.sql &&
        !entry.name.startsWith("sqlite_") &&
        !entry.name.startsWith("mastra_") &&
        tables.some((table) => table.tableName === entry.tableName),
    );

  const indexesByTable = new Map<
    string,
    Array<{ name: string; sql: string }>
  >();

  for (const index of indexes) {
    const collection = indexesByTable.get(index.tableName) ?? [];
    collection.push({ name: index.name, sql: index.sql });
    indexesByTable.set(index.tableName, collection);
  }

  return {
    tables: tables.map((table) => ({
      tableName: table.tableName || table.name,
      createSql: table.sql,
      indexes: indexesByTable.get(table.tableName) ?? [],
    })),
  };
}

interface ExportDatabaseTableParams {
  table: DatabaseTable;
}

interface ExportDatabaseTableResult {
  filename: string;
  content: string;
}

export function exportDatabaseTable(
  params: ExportDatabaseTableParams,
): ExportDatabaseTableResult {
  const { table } = params;

  const safeFilename = table.tableName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-");

  const payload = {
    name: table.tableName,
    createSql: table.createSql,
    indexes: table.indexes,
  };

  return {
    filename: `${safeFilename}.json`,
    content: JSON.stringify(payload, null, 2) + "\n",
  };
}

interface StripSrcPrefixParams {
  paths: string[];
}

export function stripSrcPrefix(params: StripSrcPrefixParams): string[] {
  const { paths } = params;
  return paths.map((p) => p.replace(/^\/src\//, "/"));
}

interface BuildManifestParams {
  projectInfo: {
    slug: string;
    title: string;
    description?: string;
  };
  exporterInfo: {
    orgSlug: string;
    userId: string;
    userEmail?: string;
  };
  resources: {
    tools: string[];
    views: string[];
    workflows: string[];
    documents: string[];
    database: string[];
  };
  dependencies: {
    mcps: string[];
  };
}

export function buildManifest(params: BuildManifestParams): Manifest {
  const { projectInfo, exporterInfo, resources, dependencies } = params;

  return createManifest(
    {
      slug: projectInfo.slug,
      title: projectInfo.title,
      description: projectInfo.description,
    },
    {
      orgSlug: exporterInfo.orgSlug,
      userId: exporterInfo.userId,
      userEmail: exporterInfo.userEmail,
    },
    {
      tools: stripSrcPrefix({ paths: resources.tools }),
      views: stripSrcPrefix({ paths: resources.views }),
      workflows: stripSrcPrefix({ paths: resources.workflows }),
      documents: stripSrcPrefix({ paths: resources.documents }),
      database: resources.database,
    },
    {
      mcps: dependencies.mcps,
    },
  );
}

interface GenerateZipParams {
  zip: JSZip;
}

interface GenerateZipResult {
  buffer: Buffer;
  base64: string;
}

export async function generateZip(
  params: GenerateZipParams,
): Promise<GenerateZipResult> {
  const { zip } = params;

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const base64 = zipBuffer.toString("base64");

  return { buffer: zipBuffer, base64 };
}
