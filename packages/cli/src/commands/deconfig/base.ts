import { Buffer } from "node:buffer";
import { createWorkspaceClient, workspaceClientParams } from "../../lib/mcp.js";

export interface FileChangeEvent {
  type: "added" | "modified" | "deleted";
  path: string;
  metadata?: {
    address: string;
    metadata: Record<string, unknown>;
    sizeInBytes: number;
    mtime: number;
    ctime: number;
  };
  timestamp: number;
  patchId: number;
}

export interface FileChangeEventWithContent extends FileChangeEvent {
  content?: Buffer; // File content for added/modified files
}

export interface WatchOptions {
  branchName: string;
  pathFilter?: string;
  fromCtime?: number;
  workspace?: string;
  local?: boolean;
}

/**
 * Fetch file content using the READ_FILE MCP tool
 */
export async function fetchFileContent(
  filePath: string,
  branchName: string,
  workspace?: string,
  local?: boolean,
): Promise<Buffer> {
  const client = await createWorkspaceClient({
    workspace,
    local,
  });

  try {
    // Call the READ_FILE tool via MCP
    const response = await client.callTool({
      name: "READ_FILE",
      arguments: {
        branch: branchName,
        path: filePath,
      },
    });

    if (response.isError) {
      const errorMessage = Array.isArray(response.content)
        ? response.content[0]?.text || "Failed to read file"
        : "Failed to read file";
      throw new Error(errorMessage);
    }

    const result = response.structuredContent as { content: string };
    if (!result || !result.content) {
      throw new Error("No content returned from READ_FILE tool");
    }

    // Decode base64 content to Buffer
    return Buffer.from(result.content, "base64");
  } catch (error) {
    console.error(
      `❌ Failed to fetch content for ${filePath}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    // Always close the client connection
    await client.close();
  }
}

/**
 * Put file content using the PUT_FILE MCP tool
 */
export async function putFileContent(
  filePath: string,
  content: Buffer | string,
  branchName: string,
  metadata?: Record<string, unknown>,
  workspace?: string,
  local?: boolean,
): Promise<void> {
  const client = await createWorkspaceClient({
    workspace,
    local,
  });

  try {
    // Convert content to base64
    const base64Content = Buffer.isBuffer(content)
      ? content.toString("base64")
      : Buffer.from(content).toString("base64");

    // Call the PUT_FILE tool via MCP
    const response = await client.callTool({
      name: "PUT_FILE",
      arguments: {
        branch: branchName,
        path: filePath,
        content: { base64: base64Content },
        metadata,
      },
    });

    if (response.isError) {
      const errorMessage = Array.isArray(response.content)
        ? response.content[0]?.text || "Failed to put file"
        : "Failed to put file";
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error(
      `❌ Failed to put file ${filePath}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    // Always close the client connection
    await client.close();
  }
}

/**
 * Watch a deconfig branch for changes and call the callback with events including file content
 */
export async function watch(
  options: WatchOptions,
  callback: (event: FileChangeEventWithContent) => Promise<void> | void,
): Promise<void> {
  const {
    branchName,
    fromCtime = 1,
    pathFilter,
    workspace,
    local = false,
  } = options;

  console.log(`📡 Watching branch "${branchName}" for changes...`);
  if (pathFilter) {
    console.log(`   🔍 Path filter: ${pathFilter}`);
  }

  // Get workspace client params for authentication headers
  const { headers, url: baseUrl } = await workspaceClientParams({
    workspace,
    local,
    pathname: "/deconfig/watch",
  });

  // Build SSE URL
  const searchParams = new URLSearchParams();
  searchParams.set("branchName", branchName);
  searchParams.set("fromCtime", fromCtime.toString());

  if (pathFilter) {
    searchParams.set("pathFilter", pathFilter);
  }

  const sseUrlObj = new URL(baseUrl);
  sseUrlObj.search = searchParams.toString();

  const sseUrl = sseUrlObj.href;

  // Set up SSE connection with retry logic
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  const connect = async (): Promise<void> => {
    console.log(`🔄 Connecting to SSE stream... (attempt ${retryCount + 1})`);

    try {
      // Use fetch with ReadableStream for Node.js compatibility
      const response = await fetch(sseUrl, {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      console.log("✅ Connected to SSE stream");
      retryCount = 0; // Reset retry count on successful connection

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("📡 SSE stream ended");
            break;
          }

          // Decode and process SSE data
          const chunk = decoder.decode(value, { stream: true });
          console.log(`📦 Received chunk: ${JSON.stringify(chunk)}`);

          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              console.log(`📝 Processing line: ${JSON.stringify(line)}`);
            }
            await processSSELine(line, branchName, workspace, local, callback);
          }
        }
      } catch (error) {
        console.error("❌ Error reading SSE stream:", error);
        throw error;
      }
    } catch (error) {
      console.error(
        "❌ SSE connection failed:",
        error instanceof Error ? error.message : String(error),
      );

      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
        setTimeout(() => {
          connect().catch((retryError) => {
            console.error(
              "❌ Retry failed:",
              retryError instanceof Error
                ? retryError.message
                : String(retryError),
            );
          });
        }, retryDelay);
      } else {
        throw new Error(`Failed to connect after ${maxRetries} attempts`);
      }
    }
  };

  // Start the connection
  await connect();
}

async function processSSELine(
  line: string,
  branchName: string,
  workspace: string | undefined,
  local: boolean,
  callback: (event: FileChangeEventWithContent) => Promise<void> | void,
): Promise<void> {
  if (!line.trim()) return;

  // Parse SSE format: "event: change" and "data: {...}"
  if (line.startsWith("event:")) {
    // Just log the event type for now
    const eventType = line.substring(6).trim();
    if (eventType === "change") {
      // We expect the data line next
    }
    return;
  }

  if (line.startsWith("data:")) {
    const jsonData = line.substring(5).trim();
    console.log(`🔍 Parsing JSON data: ${jsonData}`);

    try {
      const event: FileChangeEvent = JSON.parse(jsonData);
      console.log(`✅ Parsed event:`, event);

      // Fetch content for added/modified files
      const eventWithContent: FileChangeEventWithContent = { ...event };

      if (event.type === "added" || event.type === "modified") {
        console.log(`📥 Fetching content for ${event.path}...`);
        try {
          eventWithContent.content = await fetchFileContent(
            event.path,
            branchName,
            workspace,
            local,
          );
          console.log(
            `✅ Fetched content: ${eventWithContent.content?.length} bytes`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to fetch content for ${event.path}:`,
            error instanceof Error ? error.message : String(error),
          );
          // Continue without content - let the callback decide how to handle
        }
      }

      // Call the user's callback
      console.log(`🔄 Calling callback for event: ${event.type} ${event.path}`);
      await callback(eventWithContent);
    } catch (error) {
      console.error("❌ Failed to parse SSE data:", jsonData, error);
    }
  }
}
