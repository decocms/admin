import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  type Agent,
  type Integration,
  KNOWLEDGE_BASE_DIMENSION,
  useAddFileToKnowledge,
  useCreateKnowledge,
  useFiles,
  useIntegrations,
  useReadFile,
  useWriteFile,
} from "@deco/sdk";
import { getKnowledgeBaseIntegrationId } from "@deco/sdk/utils";

/* Must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 63 characters long. */
const parseToValidIndexName = (uuid: string) => `_${uuid.replaceAll("-", "_")}`;

interface UseAgentKnowledgeIntegrationProps {
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  agent: Agent;
}

export const useAgentKnowledgeIntegration = (
  { setIntegrationTools, agent }: UseAgentKnowledgeIntegrationProps,
) => {
  const { id: idProp } = agent;
  const id = useMemo(() => parseToValidIndexName(idProp), [idProp]);
  const knowledgeIntegrationId = useMemo(
    () => getKnowledgeBaseIntegrationId(id),
    [id],
  );
  const integrations = useIntegrations();
  const knowledgeIntegration = useMemo(
    () =>
      integrations.data?.find((integration) =>
        integration.id === knowledgeIntegrationId
      ),
    [knowledgeIntegrationId, integrations],
  );

  const createKnowledge = useCreateKnowledge();

  const createAgentKnowledge = async () => {
    if (knowledgeIntegration) {
      return { name: id, dimmension: KNOWLEDGE_BASE_DIMENSION };
    }
    const kb = await createKnowledge.mutateAsync({ name: id });
    integrations.refetch();

    setIntegrationTools(knowledgeIntegrationId, ["KNOWLEDGE_BASE_SEARCH"]);

    return kb;
  };

  return {
    integration: knowledgeIntegration,
    createAgentKnowledge,
  };
};

export const useAgentFiles = (agentId: string) => {
  const prefix = useAgentKnowledgeRootPath(agentId);
  return useFiles({ root: prefix });
};

const agentKnowledgeBasePath = (agentId: string) =>
  `agent/${agentId}/knowledge`;

const agentKnowledgeBaseFilepath = (agentId: string, path: string) =>
  `${agentKnowledgeBasePath(agentId)}/${path}`;

const useAgentKnowledgeRootPath = (agentId: string) =>
  useMemo(() => agentKnowledgeBasePath(agentId), [agentId]);

export interface UploadFile {
  file: File;
  file_url?: string;
  uploading?: boolean;
  docIds?: string[];
}

interface UseUploadAgentKnowledgeFilesProps {
  agent: Agent;
  onAddFile: Dispatch<SetStateAction<UploadFile[]>>;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}

export const useUploadAgentKnowledgeFiles = (
  { agent, onAddFile, setIntegrationTools }: UseUploadAgentKnowledgeFilesProps,
) => {
  const { integration: knowledgeIntegration, createAgentKnowledge } =
    useAgentKnowledgeIntegration({
      agent,
      setIntegrationTools,
    });
  const { refetch: refetchAgentKnowledgeFiles } = useAgentFiles(agent.id);
  const writeFileMutation = useWriteFile();
  const addFileToKnowledgeBase = useAddFileToKnowledge();
  const readFile = useReadFile();
  const knowledeIntegrationPromise = useRef<PromiseWithResolvers<Integration>>(
    null,
  );

  useEffect(() => {
    if (!knowledeIntegrationPromise.current || !knowledgeIntegration) return;

    knowledeIntegrationPromise.current.resolve(knowledgeIntegration);
  }, [knowledgeIntegration]);

  const _uploadKnowledgeFiles = async (
    files: File[],
    knowledgeIntegration: Integration,
  ) => {
    if (!knowledgeIntegration.connection) {
      throw new Error("Not found knowledge for this agent");
    }

    try {
      // Upload each file using the writeFileMutation
      const uploadPromises = files.map(async (file) => {
        try {
          const filename = file.name;
          const path = agentKnowledgeBaseFilepath(agent.id, filename);
          const buffer = await file.arrayBuffer();

          // TODO: add filesize at metadata
          const fileMetadata = {
            agentId: agent.id,
            type: file.type,
            bytes: file.size.toString(),
          };

          const fileMutateData = {
            path,
            contentType: file.type || "application/octet-stream",
            content: new Uint8Array(buffer),
            metadata: fileMetadata,
          };

          const savedResponse = await writeFileMutation.mutateAsync(
            fileMutateData,
          );

          if (!savedResponse.ok) {
            // TODO: handle erro
            return;
          }

          const fileUrl = await readFile(
            path,
          );

          if (!fileUrl) {
            // TODO: delete file if failed
            return;
          }

          const content = await addFileToKnowledgeBase.mutateAsync({
            connection: knowledgeIntegration?.connection,
            fileUrl,
            metadata: {
              path,
            },
            path,
          });

          // TODO: fix this when forContext is fixed the return
          // deno-lint-ignore no-explicit-any
          const docIds = (content as any).docIds ??
            // deno-lint-ignore no-explicit-any
            (content as any)?.structuredContent?.docIds;

          await writeFileMutation.mutateAsync({
            ...fileMutateData,
            skipWrite: true,
            metadata: {
              ...fileMetadata,
              docIds,
            },
          });
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);

          // Remove failed upload from the list
          onAddFile((prev) => prev.filter((fileObj) => fileObj.file !== file));

          throw error;
        }
      });

      await Promise.all(uploadPromises);
      await refetchAgentKnowledgeFiles();

      // Small delay to ensure UI has updated with refetched files before clearing uploading files
      // This prevents the flickering effect where files disappear and reappear
      setTimeout(() => {
        onAddFile([]);
      }, 100);
    } catch (error) {
      console.error("Failed to upload some knowledge files:", error);
    }
  };

  const uploadKnowledgeFiles = async (files: File[]) => {
    onAddFile((
      prev,
    ) => [...prev, ...files.map((file) => ({ file, uploading: true }))]);
    if (!knowledgeIntegration?.connection) {
      await createAgentKnowledge();
      knowledeIntegrationPromise.current = Promise.withResolvers();

      await knowledeIntegrationPromise.current.promise;
    }
    const kbIntegration = knowledgeIntegration ??
      (await knowledeIntegrationPromise.current?.promise);
    if (!kbIntegration) throw new Error("Not found knowledge for this agent");
    return _uploadKnowledgeFiles(files, kbIntegration);
  };

  return {
    uploadKnowledgeFiles,
  };
};
