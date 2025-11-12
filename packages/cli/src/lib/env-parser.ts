import { promises as fs } from "fs";
import { join, isAbsolute } from "path";

/**
 * Parse env file content in .env format (KEY=VALUE per line)
 * Reuses the same logic as getCurrentEnvVars from wrangler.ts
 */
export function parseEnvFileContent(content: string): Record<string, string> {
  return content.split("\n").reduce(
    (acc, line) => {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }
      const firstEqualIndex = trimmed.indexOf("=");
      if (firstEqualIndex === -1) {
        return acc;
      }
      const key = trimmed.substring(0, firstEqualIndex);
      if (!key) {
        console.warn(
          `Warning: Skipping invalid environment variable line with empty key: "${trimmed}"`,
        );
        return acc;
      }
      const value = trimmed.substring(firstEqualIndex + 1);
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Parse JSON object to env vars (converts all values to strings)
 */
export function parseJsonEnvVars(jsonObj: unknown): Record<string, string> {
  if (typeof jsonObj !== "object" || jsonObj === null) {
    throw new Error("Invalid JSON: expected object");
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(jsonObj)) {
    result[key] = typeof value === "string" ? value : String(value);
  }
  return result;
}

/**
 * Parse env vars from a file (supports both JSON and .env-like formats)
 * Tries JSON.parse first, falls back to .env-like format
 */
export async function parseEnvFile(
  filePath: string,
  workingDir: string,
): Promise<Record<string, string>> {
  const envFilePath = isAbsolute(filePath)
    ? filePath
    : join(workingDir, filePath);

  const fileContent = await fs.readFile(envFilePath, "utf-8");

  // Try JSON.parse first, fallback to .env-like format
  try {
    const jsonObj = JSON.parse(fileContent);
    return parseJsonEnvVars(jsonObj);
  } catch {
    // Not JSON, parse as .env-like format
    return parseEnvFileContent(fileContent);
  }
}

/**
 * Parse inline JSON env vars from CLI
 */
export function parseInlineJsonEnvVars(
  jsonString: string,
): Record<string, string> {
  const jsonObj = JSON.parse(jsonString);
  return parseJsonEnvVars(jsonObj);
}

/**
 * Parse KEY=VALUE format env var
 */
export function parseKeyValueEnvVar(input: string): {
  key: string;
  value: string;
} | null {
  const eqIndex = input.indexOf("=");
  if (eqIndex === -1) {
    return null;
  }

  const key = input.slice(0, eqIndex);
  if (!key) {
    console.warn(
      `Warning: Skipping invalid environment variable line with empty key: "${input}"`,
    );
    return null;
  }
  const value = input.slice(eqIndex + 1);
  return { key, value };
}

/**
 * Check if input looks like a file path
 */
export function isFilePath(input: string): boolean {
  if (input.includes("/") || input.includes("\\")) return true;
  if (input.startsWith(".env")) return true;
  if (input.endsWith(".json")) return true;

  return false;
}
