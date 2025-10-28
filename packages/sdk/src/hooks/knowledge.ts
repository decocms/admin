import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSDK } from "./index.ts";
import {
  createKnowledge,
  knowledgeAddFile,
  knowledgeDeleteFile,
  knowledgeListFiles,
} from "../crud/knowledge.ts";
import type { Integration } from "../index.ts";
import { KEYS } from "./react-query-keys.ts";

const getConnectionUrl = ({ connection }: ForConnection) =>
  connection && "url" in connection ? connection.url : "";

interface ForConnection {
  connection?: Integration["connection"];
}

export const useCreateKnowledge = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: ({ name }: { name: string }) =>
      createKnowledge({ locator: locator, name }),
  });
};

interface AddFileToKnowledgeParams extends ForConnection {
  fileUrl: string;
  path: string;
  filename?: string;
  metadata?: Record<string, string>;
}

export const useKnowledgeAddFile = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      fileUrl,
      metadata,
      path,
      filename,
      connection,
    }: AddFileToKnowledgeParams) =>
      knowledgeAddFile({
        locator: locator,
        fileUrl,
        metadata,
        path,
        filename,
        connection,
      }),
    onSuccess: (fileResponse, { connection }) => {
      const connectionUrl = getConnectionUrl({ connection });
      const knowledgeFilesKey = KEYS.KNOWLEDGE_FILES(locator, connectionUrl);
      client.cancelQueries({ queryKey: knowledgeFilesKey });
      client.setQueryData<Awaited<ReturnType<typeof knowledgeListFiles>>>(
        knowledgeFilesKey,
        (old) => (!old ? [fileResponse] : [fileResponse, ...old]),
      );
    },
  });
};

interface KnowledgeDeleteFileParams extends ForConnection {
  fileUrl: string;
}

export const useKnowledgeDeleteFile = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ connection, fileUrl }: KnowledgeDeleteFileParams) =>
      knowledgeDeleteFile({ locator: locator, fileUrl, connection }),
    onSuccess: (_, { fileUrl, connection }) => {
      const connectionUrl = getConnectionUrl({ connection });
      const knowledgeFilesKey = KEYS.KNOWLEDGE_FILES(locator, connectionUrl);

      client.cancelQueries({ queryKey: knowledgeFilesKey });
      client.setQueryData<Awaited<ReturnType<typeof knowledgeListFiles>>>(
        knowledgeFilesKey,
        (old) => (!old ? [] : old.filter((file) => file.fileUrl !== fileUrl)),
      );
    },
  });
};

interface KnowledgeListFilesParams extends ForConnection {}

export const useKnowledgeListFiles = (params: KnowledgeListFilesParams) => {
  const { locator } = useSDK();
  const { connection } = params;
  const connectionUrl = getConnectionUrl(params);
  const hasConnection = "connection" in params;

  return useQuery({
    queryKey: KEYS.KNOWLEDGE_FILES(locator, connectionUrl),
    queryFn: () =>
      "connection" in params
        ? knowledgeListFiles({ locator: locator, connection })
        : [],
    enabled: hasConnection ? !!connectionUrl : true,
  });
};
