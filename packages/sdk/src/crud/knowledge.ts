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
  locator,
  metadata,
  path,
  filename,
  connection,
}: KnowledgeAddFileParams) =>
  getClientFor(locator, connection).KNOWLEDGE_BASE_ADD_FILE({
    fileUrl,
    metadata,
    path,
    filename,
  });

interface KnowledgeListFilesParams extends FromWorkspace, ForConnection {}

export const knowledgeListFiles = ({
  locator,
  connection,
}: KnowledgeListFilesParams) =>
  getClientFor(locator, connection)
    .KNOWLEDGE_BASE_LIST_FILES({})
    .then((res) => res.items);

interface KnowledgeDeleteFileParams extends FromWorkspace, ForConnection {
  fileUrl: string;
}

export const knowledgeDeleteFile = ({
  locator,
  connection,
  fileUrl,
}: KnowledgeDeleteFileParams) =>
  getClientFor(locator, connection).KNOWLEDGE_BASE_DELETE_FILE({ fileUrl });

interface CreateKnowledgeParams extends FromWorkspace {
  name: string;
}

export const createKnowledge = ({ locator, name }: CreateKnowledgeParams) =>
  MCPClient.forLocator(locator).KNOWLEDGE_BASE_CREATE({
    name,
  });
