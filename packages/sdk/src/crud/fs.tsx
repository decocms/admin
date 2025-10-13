import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

interface ListOptions {
  locator: ProjectLocator;
  root: string;
}

export const listFiles = async ({
  locator,
  root,
}: ListOptions): Promise<unknown[]> => {
  const data = (await MCPClient.forLocator(locator).FS_LIST({
    prefix: root,
  })) as { items: unknown[] };

  return data.items;
};

interface WriteOptions {
  path: string;
  locator: ProjectLocator;
  content: Uint8Array;
  contentType: string;
  expiresIn?: number;
  metadata?: Record<string, string | string[]>;
}

export const writeFile = async ({
  path,
  locator,
  content,
  contentType,
  expiresIn,
  metadata,
}: WriteOptions): Promise<{ url: string }> => {
  const { url: uploadUrl } = (await MCPClient.forLocator(locator).FS_WRITE({
    path,
    contentType,
    metadata,
    ...(expiresIn ? { expiresIn } : {}),
  })) as { url: string };

  const response = await fetch(uploadUrl!, {
    method: "PUT",
    // @ts-ignore todo: cloudflare types should not be affecting this
    body: content,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!response.ok) {
    console.error(response);
    throw new Error("Failed to upload file");
  }

  return { url: uploadUrl };
};

interface ReadOptions {
  locator: ProjectLocator;
  path: string;
  expiresIn?: number;
}

export const readFile = async ({
  locator,
  path,
  expiresIn,
}: ReadOptions): Promise<{ url: string } | null> => {
  if (!path) {
    return null;
  }

  const { url } = (await MCPClient.forLocator(locator).FS_READ({
    path,
    ...(expiresIn ? { expiresIn } : {}),
  })) as { url: string };

  return { url };
};

interface DeleteOptions {
  locator: ProjectLocator;
  path: string;
}

export const deleteFile = ({ locator, path }: DeleteOptions) =>
  MCPClient.forLocator(locator).FS_DELETE({ path });
