import { useFile } from "@deco/sdk";
import { Avatar, type AvatarProps } from "./index.tsx";

export interface AgentAvatarProps extends Omit<AvatarProps, "shape"> {
  /**
   * The URL or file path of the avatar image
   * - If it's an https:// URL, it will be used directly
   * - If it's a file path, it will be resolved using useFile hook
   */
  url?: string;
}

/**
 * AgentAvatar - Specialized avatar for AI agents and bots
 *
 * Features:
 * - Always square shape (agents are entities/brands)
 * - Intelligent URL handling (auto-resolves file paths to URLs)
 * - Default size="base" and objectFit="cover"
 */
export function AgentAvatar({
  url,
  size = "base",
  objectFit = "cover",
  ...props
}: AgentAvatarProps) {
  // Check if URL is already a valid HTTPS URL
  const isValidUrl = url?.startsWith("https://") || url?.startsWith("http://");

  // Use useFile hook only for non-URL paths
  const { data: resolvedFileUrl } = useFile(url && !isValidUrl ? url : "");

  // Determine the final URL to use
  const finalUrl = isValidUrl
    ? url
    : (typeof resolvedFileUrl === "string" ? resolvedFileUrl : undefined);

  return (
    <Avatar
      shape="square"
      size={size}
      objectFit={objectFit}
      url={finalUrl}
      {...props}
    />
  );
}
