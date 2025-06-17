import { MCPClient } from "../fetcher.ts";
import type { Integration, Workspace } from "../index.ts";

interface FromWorkspace {
  workspace: Workspace;
}

interface ForConnection {
  connection: Integration["connection"];
}

const getClientFor = (
  workspace: Workspace,
  connection?: Integration["connection"],
) => {
  return connection
    ? MCPClient.forConnection(connection)
    : MCPClient.forWorkspace(workspace);
};

interface AddFileToKnowledgeParams
  extends FromWorkspace, Partial<ForConnection> {
  fileUrl: string;
  path: string;
  metadata?: Record<string, string>;
}
export const addFileToKnowledge = (
  { fileUrl, workspace, metadata, path, connection }: AddFileToKnowledgeParams,
) =>
  getClientFor(workspace, connection).KNOWLEDGE_BASE_ADD_FILE({
    fileUrl,
    metadata,
    path,
  });

interface RemoveFromKnowledgeParams
  extends FromWorkspace, Partial<ForConnection> {
  docIds: string[];
}
export const removeFromKnowledge = (
  { docIds, workspace, connection }: RemoveFromKnowledgeParams,
) => getClientFor(workspace, connection).KNOWLEDGE_BASE_FORGET({ docIds });

interface CreateKnowledgeParams extends FromWorkspace {
  name: string;
}

export const createKnowledge = ({ workspace, name }: CreateKnowledgeParams) =>
  MCPClient.forWorkspace(workspace).KNOWLEDGE_BASE_CREATE({
    name,
  });
