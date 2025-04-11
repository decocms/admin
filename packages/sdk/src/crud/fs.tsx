import { API_HEADERS, API_SERVER_URL } from "../constants.ts";

// File system module interfaces
export interface FileSystemOptions {
  /** Encoding to use for file operations */
  encoding?: string;
  /** File mode (permissions) */
  mode?: number;
  /** File flags */
  flag?: string;
}

const fetchAPI = <T extends object>(
  path: string,
  opts?: T,
  init?: RequestInit,
) => {
  const url = new URL(`/fs/file`, API_SERVER_URL);
  url.searchParams.set("path", path);
  url.searchParams.set("opts", JSON.stringify(opts));

  return fetch(url, {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });
};

export const readFile = async (path: string, options?: FileSystemOptions) => {
  const response = await fetchAPI(path, options, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Failed to read file: ${response.statusText}`);
  }

  return response.text();
};

export const writeFile = async (
  path: string,
  content: string | Uint8Array,
  options?: FileSystemOptions,
) => {
  const response = await fetchAPI(path, options, {
    method: "POST",
    body: typeof content === 'string' ? JSON.stringify({ content }) : content,
    headers: {
      'content-type': typeof content === 'string' ? 'application/json' : 'application/octet-stream'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to create file: ${response.statusText}`);
  }

  return response.json();
};

export const deleteFile = async (path: string, options?: FileSystemOptions) => {
  const response = await fetchAPI(path, options, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }

  return response.json();
};
