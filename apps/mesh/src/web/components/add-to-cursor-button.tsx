import { Button } from "@deco/ui/components/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

/**
 * MCP server configuration for HTTP/SSE servers
 * Follows the mcp.json format for Cursor IDE
 */
export interface MCPServerConfig {
  /**
   * URL of the HTTP/SSE MCP server
   * @example "https://mesh.example.com/mcp/connection-id"
   */
  url: string;

  /**
   * Optional headers to include with requests
   */
  headers?: Record<string, string>;
}

interface AddToCursorButtonProps {
  /**
   * Name of the MCP server (will be used as the server identifier)
   */
  serverName: string;

  /**
   * MCP server configuration
   */
  config: MCPServerConfig;

  /**
   * Button variant style
   * @default "default"
   */
  variant?: "default" | "outline" | "ghost" | "secondary" | "link";

  /**
   * Button size
   * @default "default"
   */
  size?: "default" | "sm" | "lg" | "icon";

  /**
   * Custom class name for the button
   */
  className?: string;

  /**
   * Button text
   * @default "Install"
   */
  children?: React.ReactNode;
}

/**
 * Unicode-safe base64 encoding for browser environments
 * Converts a string to UTF-8 bytes, then to base64
 */
function utf8ToBase64(str: string): string {
  // Use TextEncoder to convert string to UTF-8 bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  // Convert bytes to binary string, then to base64
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );
  return btoa(binary);
}

/**
 * Generates a Cursor MCP installation deeplink
 */
function generateCursorDeeplink(
  serverName: string,
  config: MCPServerConfig,
): string {
  // Convert config to JSON string and encode to Unicode-safe base64
  const configJson = JSON.stringify(config);
  const base64Config = utf8ToBase64(configJson);

  // Generate the deeplink with properly encoded parameters
  const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(base64Config)}`;

  return deeplink;
}

/**
 * Button component for adding HTTP/SSE MCP servers to Cursor IDE
 *
 * The button displays the Cursor logo (which includes the "CURSOR" text)
 * alongside optional custom text. By default shows "Install".
 *
 * Hovering over the button displays a tooltip with the full MCP server URL.
 *
 * @example
 * ```tsx
 * <AddToCursorButton
 *   serverName="my-mesh-server"
 *   config={{ url: "https://mesh.example.com/mcp/connection-id" }}
 * />
 * ```
 */
export function AddToCursorButton({
  serverName,
  config,
  variant = "default",
  size = "default",
  className,
  children = "Install",
}: AddToCursorButtonProps) {
  const deeplink = generateCursorDeeplink(serverName, config);

  const handleClick = () => {
    // Open the deeplink in the default browser
    window.open(deeplink, "_blank");
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn("gap-3", className)}
            onClick={handleClick}
          >
            <img src="/logos/cursor.svg" alt="Cursor" className="h-5 w-auto" />
            {children && <span>{children}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-mono max-w-md break-all">{config.url}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
