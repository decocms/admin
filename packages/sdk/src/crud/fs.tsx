import { MCPClient } from "../fetcher.ts";

interface ListOptions {
  workspace: string;
  root: string;
}

export const listFiles = async ({ workspace, root }: ListOptions) => {
  const { data } = await MCPClient
    .forWorkspace(workspace)
    .FS_LIST({ prefix: root });

  return data;
};

interface WriteOptions {
  path: string;
  workspace: string;
  content: Uint8Array;
  contentType: string;
  expiresIn?: number;
}

export const writeFile = async ({
  path,
  workspace,
  content,
  contentType,
  expiresIn,
}: WriteOptions) => {
  const { data: uploadUrl } = await MCPClient
    .forWorkspace(workspace)
    .FS_WRITE({ path, contentType, ...(expiresIn ? { expiresIn } : {}) });

  const response = await fetch(uploadUrl!, {
    method: "PUT",
    body: content,
    headers: {
      "Content-Type": contentType,
    },
  });

  return response;
};

interface ReadOptions {
  workspace: string;
  path: string;
  expiresIn?: number;
}

export const readFile = async ({
  workspace,
  path,
  expiresIn,
}: ReadOptions) => {
  const { data } = await MCPClient
    .forWorkspace(workspace)
    .FS_READ({ path, ...(expiresIn ? { expiresIn } : {}) });

  return data; // presigned GET url
};
