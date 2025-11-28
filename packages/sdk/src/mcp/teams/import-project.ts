import { z } from "zod/v3";
import JSZip from "jszip";
import {
  sanitizeProjectPath,
  IMPORT_ARCHIVE_SIZE_LIMIT_BYTES,
  IMPORT_FILE_SIZE_LIMIT_BYTES,
  IMPORT_MAX_FILE_COUNT,
  encodeBytesToBase64,
} from "../projects/file-utils.ts";
import { parseManifest, type Manifest } from "../projects/manifest.ts";
import {
  viewCodeToJson,
  toolCodeToJson,
  workflowCodeToJson,
  detectResourceType,
} from "../projects/code-conversion.ts";
import { UserInputError } from "../../errors.ts";

interface ParseGithubUrlParams {
  githubUrl: string;
}

interface ParseGithubUrlResult {
  owner: string;
  repo: string;
  ref?: string;
}

export function parseGithubUrl(
  params: ParseGithubUrlParams,
): ParseGithubUrlResult {
  const { githubUrl } = params;

  const urlMatch = githubUrl.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?$/,
  );

  if (!urlMatch) {
    throw new UserInputError(
      "Invalid GitHub URL. Expected format: https://github.com/owner/repo",
    );
  }

  const [, owner, repo, ref] = urlMatch;
  return { owner, repo, ref };
}

interface DownloadGithubRepoParams {
  owner: string;
  repo: string;
  ref?: string;
}

export async function downloadGithubRepo(
  params: DownloadGithubRepoParams,
): Promise<ArrayBuffer> {
  const { owner, repo, ref } = params;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${ref || "main"}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "deco-cms",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new UserInputError(
        `Repository not found or branch "${ref || "main"}" does not exist. Make sure the repository is public.`,
      );
    }
    throw new Error(
      `Failed to download from GitHub: ${response.status} ${response.statusText}`,
    );
  }

  const contentLengthHeader = response.headers.get("content-length");
  const declaredArchiveSize = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : undefined;

  if (
    typeof declaredArchiveSize === "number" &&
    Number.isFinite(declaredArchiveSize) &&
    declaredArchiveSize > IMPORT_ARCHIVE_SIZE_LIMIT_BYTES
  ) {
    throw new UserInputError(
      `Repository archive exceeds the ${Math.round(IMPORT_ARCHIVE_SIZE_LIMIT_BYTES / (1024 * 1024))}MB limit. Trim the repository before importing.`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > IMPORT_ARCHIVE_SIZE_LIMIT_BYTES) {
    throw new UserInputError(
      `Repository archive exceeds the ${Math.round(IMPORT_ARCHIVE_SIZE_LIMIT_BYTES / (1024 * 1024))}MB limit. Trim the repository before importing.`,
    );
  }

  return arrayBuffer;
}

interface ExtractZipFilesParams {
  arrayBuffer: ArrayBuffer;
}

interface ExtractZipFilesResult {
  files: Map<string, Uint8Array>;
  totalBytes: number;
}

export async function extractZipFiles(
  params: ExtractZipFilesParams,
): Promise<ExtractZipFilesResult> {
  const { arrayBuffer } = params;

  const zip = await JSZip.loadAsync(arrayBuffer);
  const files = new Map<string, Uint8Array>();
  let totalBytes = 0;
  let rootDir = "";

  // Find root directory (GitHub zips have a root folder like "owner-repo-sha/")
  const zipFiles = Object.keys(zip.files);
  if (zipFiles.length === 0) {
    throw new Error("Failed to extract repository: zip file is empty");
  }

  const firstFile = zipFiles[0];
  const match = firstFile.match(/^([^/]+)\//);
  if (match) {
    rootDir = match[1];
  }

  for (const [path, zipFile] of Object.entries(zip.files)) {
    if ("dir" in zipFile && zipFile.dir) continue;

    const relativePath = path.startsWith(rootDir + "/")
      ? path.substring(rootDir.length + 1)
      : path;

    if (!relativePath) {
      continue;
    }

    const sanitizedPath = sanitizeProjectPath(relativePath);
    if (!sanitizedPath) {
      throw new UserInputError(
        `Repository contains an unsupported path: "${relativePath}"`,
      );
    }

    const shouldProcess =
      sanitizedPath === "deco.mcp.json" ||
      sanitizedPath.startsWith("tools/") ||
      sanitizedPath.startsWith("views/") ||
      sanitizedPath.startsWith("workflows/") ||
      sanitizedPath.startsWith("documents/") ||
      sanitizedPath.startsWith("database/") ||
      sanitizedPath.startsWith("agents/");

    if (!shouldProcess) {
      continue;
    }

    const contentBytes = await zipFile.async("uint8array");

    if (contentBytes.byteLength > IMPORT_FILE_SIZE_LIMIT_BYTES) {
      throw new UserInputError(
        `File "${sanitizedPath}" exceeds the ${Math.round(IMPORT_FILE_SIZE_LIMIT_BYTES / (1024 * 1024))}MB per-file limit. Trim the repository before importing.`,
      );
    }

    totalBytes += contentBytes.byteLength;
    if (totalBytes > IMPORT_ARCHIVE_SIZE_LIMIT_BYTES) {
      throw new UserInputError(
        `Repository archive exceeds the ${Math.round(IMPORT_ARCHIVE_SIZE_LIMIT_BYTES / (1024 * 1024))}MB limit. Trim the repository before importing.`,
      );
    }

    files.set(sanitizedPath, contentBytes);

    if (files.size > IMPORT_MAX_FILE_COUNT) {
      throw new UserInputError(
        `Repository contains more than ${IMPORT_MAX_FILE_COUNT} supported files. Trim the repository before importing.`,
      );
    }
  }

  return { files, totalBytes };
}

interface ParseManifestFromFilesParams {
  files: Map<string, Uint8Array>;
  overrideSlug?: string;
  overrideTitle?: string;
}

interface ParseManifestFromFilesResult {
  manifest: Manifest;
  projectSlug: string;
  projectTitle: string;
}

export function parseManifestFromFiles(
  params: ParseManifestFromFilesParams,
): ParseManifestFromFilesResult {
  const { files, overrideSlug, overrideTitle } = params;
  const textDecoder = new TextDecoder();

  const manifestBytes = files.get("deco.mcp.json");
  if (!manifestBytes) {
    throw new UserInputError(
      "Manifest file 'deco.mcp.json' not found. This does not appear to be a valid deco project.",
    );
  }

  let manifest: Manifest;
  try {
    const manifestJson = JSON.parse(textDecoder.decode(manifestBytes));
    manifest = parseManifest(manifestJson);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new UserInputError(
        "Manifest file 'deco.mcp.json' is not valid JSON",
      );
    }
    if (error instanceof z.ZodError) {
      throw new UserInputError(
        `Manifest validation failed: ${error.issues.map((issue) => issue.message).join(", ")}`,
      );
    }
    throw error;
  }

  const projectSlug = overrideSlug || manifest.project.slug;
  const projectTitle = overrideTitle || manifest.project.title;

  if (!projectSlug || !projectTitle) {
    throw new UserInputError("Invalid manifest: missing project slug or title");
  }

  return { manifest, projectSlug, projectTitle };
}

interface ConvertCodeToJsonParams {
  path: string;
  contentBytes: Uint8Array;
}

interface ConvertCodeToJsonResult {
  finalPath: string;
  finalContentBytes: Uint8Array;
}

export function convertCodeFileToJson(
  params: ConvertCodeToJsonParams,
): ConvertCodeToJsonResult | null {
  const { path, contentBytes } = params;
  const textDecoder = new TextDecoder();

  const resourceType = detectResourceType(path);

  if (!resourceType) {
    return null;
  }

  const codeContent = textDecoder.decode(contentBytes);
  let jsonResource;
  let finalPath = path;

  if (resourceType === "view") {
    jsonResource = viewCodeToJson(codeContent);
    finalPath = path.replace(/\.tsx$/, ".json");
  } else if (resourceType === "tool") {
    jsonResource = toolCodeToJson(codeContent);
    finalPath = path.replace(/\.ts$/, ".json");
  } else if (resourceType === "workflow") {
    jsonResource = workflowCodeToJson(codeContent);
    finalPath = path.replace(/\.ts$/, ".json");
  }

  if (jsonResource) {
    const jsonString = JSON.stringify(jsonResource, null, 2);
    const finalContentBytes = new TextEncoder().encode(jsonString);
    return { finalPath, finalContentBytes };
  }

  return null;
}

interface PrepareFileForUploadParams {
  path: string;
  contentBytes: Uint8Array;
}

interface PrepareFileForUploadResult {
  remotePath: string;
  base64Content: string;
  shouldUpload: boolean;
}

export function prepareFileForUpload(
  params: PrepareFileForUploadParams,
): PrepareFileForUploadResult {
  const { path, contentBytes } = params;
  const textDecoder = new TextDecoder();

  const ALLOWED_ROOTS = [
    "tools/",
    "views/",
    "workflows/",
    "documents/",
    "database/",
  ];

  const shouldUpload = ALLOWED_ROOTS.some((root) => path.startsWith(root));

  if (!shouldUpload) {
    return {
      remotePath: "",
      base64Content: "",
      shouldUpload: false,
    };
  }

  let finalContentBytes = contentBytes;
  let finalPath = path;

  // Convert code files to JSON before uploading
  const conversionResult = convertCodeFileToJson({ path, contentBytes });
  if (conversionResult) {
    finalPath = conversionResult.finalPath;
    finalContentBytes = conversionResult.finalContentBytes;
  } else if (path.endsWith(".json")) {
    // Validate JSON files
    try {
      JSON.parse(textDecoder.decode(contentBytes));
    } catch {
      return {
        remotePath: "",
        base64Content: "",
        shouldUpload: false,
      };
    }
  }

  const remotePath = `/src/${finalPath}`;
  const base64Content = encodeBytesToBase64(finalContentBytes);

  return {
    remotePath,
    base64Content,
    shouldUpload: true,
  };
}

interface ParseDatabaseSchemaParams {
  path: string;
  contentBytes: Uint8Array;
}

interface ParseDatabaseSchemaResult {
  tableName: string;
  createSql: string;
  indexes: Array<{ name?: string; sql: string }>;
}

export function parseDatabaseSchema(
  params: ParseDatabaseSchemaParams,
): ParseDatabaseSchemaResult | null {
  const { path, contentBytes } = params;
  const textDecoder = new TextDecoder();

  if (
    !(path.startsWith("database/") || path.startsWith("src/database/")) ||
    !path.endsWith(".json")
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(textDecoder.decode(contentBytes)) as {
      name?: string;
      createSql?: string;
      indexes?: Array<{ name?: string; sql?: string }>;
    };

    if (!payload?.name || !payload?.createSql) {
      return null;
    }

    return {
      tableName: payload.name,
      createSql: payload.createSql,
      indexes: (payload.indexes || [])
        .map((idx) => ({
          name: idx.name,
          sql: idx.sql || "",
        }))
        .filter((idx) => idx.sql),
    };
  } catch {
    return null;
  }
}

interface ParseAgentFileParams {
  path: string;
  contentBytes: Uint8Array;
}

export interface ParsedAgentData {
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
}

export function parseAgentFile(
  params: ParseAgentFileParams,
): ParsedAgentData | null {
  const { path, contentBytes } = params;
  const textDecoder = new TextDecoder();

  if (
    !(path.startsWith("agents/") || path.startsWith("src/agents/")) ||
    !path.endsWith(".json")
  ) {
    return null;
  }

  try {
    const agentData = JSON.parse(textDecoder.decode(contentBytes));

    // Validate visibility value
    const visibility = agentData.visibility;
    const validVisibility: "PUBLIC" | "WORKSPACE" | "PRIVATE" | null =
      visibility === "PUBLIC" ||
      visibility === "WORKSPACE" ||
      visibility === "PRIVATE"
        ? visibility
        : null;

    return {
      name: agentData.name,
      avatar: agentData.avatar ?? null,
      instructions: agentData.instructions ?? null,
      description: agentData.description ?? null,
      tools_set: agentData.tools_set,
      max_steps: agentData.max_steps ?? null,
      max_tokens: agentData.max_tokens ?? null,
      model: agentData.model ?? null,
      memory: agentData.memory,
      views: agentData.views,
      visibility: validVisibility,
      temperature: agentData.temperature ?? null,
    };
  } catch {
    return null;
  }
}
