import { MCPClient } from "../fetcher.ts";
import type { Integration, ProjectLocator } from "../index.ts";
import type { ProjectTools } from "../mcp/index.ts";

interface FromWorkspace {
  locator: ProjectLocator;
}

interface ForConnection {
  connection?: Integration["connection"];
}

const getClientFor = (
  locator: ProjectLocator,
  connection?: Integration["connection"],
) => {
  return connection
    ? MCPClient.forConnection<ProjectTools>(connection)
    : MCPClient.forLocator(locator);
};

interface KnowledgeAddFileParams extends FromWorkspace, ForConnection {
  fileUrl: string;
  path: string;
  filename?: string;
  metadata?: Record<string, string>;
}

export const knowledgeAddFile = ({
  fileUrl,
  locator: locator,
  metadata,
  path,
  filename,
  connection,
}: KnowledgeAddFileParams): Promise<unknown> =>
  getClientFor(locator, connection).KNOWLEDGE_BASE_ADD_FILE({
    fileUrl,
    metadata,
    path,
    filename,
  }) as Promise<unknown>;

interface KnowledgeListFilesParams extends FromWorkspace, ForConnection {}

export const knowledgeListFiles = ({
  locator: locator,
  connection,
}: KnowledgeListFilesParams): Promise<
  Array<{
    fileUrl: string;
    metadata: Record<string, unknown>;
    filename: string;
    status: string;
  }>
> =>
  getClientFor(locator, connection)
    .KNOWLEDGE_BASE_LIST_FILES({})
    .then(
      (res) =>
        (
          res as {
            items: Array<{
              fileUrl: string;
              metadata: Record<string, unknown>;
              filename: string;
              status: string;
            }>;
          }
        ).items,
    );

interface KnowledgeDeleteFileParams extends FromWorkspace, ForConnection {
  fileUrl: string;
}

export const knowledgeDeleteFile = ({
  locator: locator,
  connection,
  fileUrl,
}: KnowledgeDeleteFileParams): Promise<unknown> =>
  getClientFor(locator, connection).KNOWLEDGE_BASE_DELETE_FILE({
    fileUrl,
  }) as Promise<unknown>;

interface CreateKnowledgeParams extends FromWorkspace {
  name: string;
}

export const createKnowledge = ({
  locator: locator,
  name,
}: CreateKnowledgeParams): Promise<unknown> =>
  MCPClient.forLocator(locator).KNOWLEDGE_BASE_CREATE({
    name,
  }) as Promise<unknown>;
