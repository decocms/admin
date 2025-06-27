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
  useDeleteFile,
  useFiles,
  useIntegrations,
  useReadFile,
  useRemoveFromKnowledge,
  useWriteFile,
} from "@deco/sdk";
import {
  getKnowledgeBaseIntegrationId,
  parseToValidIndexName,
} from "@deco/sdk/utils";
import { toast } from "@deco/ui/components/sonner.tsx";

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
  const deleteFile = useDeleteFile();
  const removeFromKnowledge = useRemoveFromKnowledge();
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
        let fileWasUploaded = false;
        let filePath = "";
        let docIds: string[] | undefined;

        try {
          const filename = file.name;
          const path = agentKnowledgeBaseFilepath(agent.id, filename);
          filePath = path;
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
            toast.error(`Failed to upload file ${filename}`);
            throw new Error(`Failed to upload file ${filename}`);
          }

          fileWasUploaded = true;

          const fileUrl = await readFile(
            path,
          );

          if (!fileUrl) {
            toast.error(`Failed to read uploaded file ${filename}`);
            throw new Error(`Failed to read uploaded file ${filename}`);
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
          docIds = (content as any).docIds ??
            // deno-lint-ignore no-explicit-any
            (content as any)?.structuredContent?.docIds;

          // Check if docIds are empty or invalid
          if (!docIds || !Array.isArray(docIds) || docIds.length === 0) {
            toast.error(`Failed to add ${filename} to knowledge base`);
            throw new Error(
              `Failed to add ${filename} to knowledge base: no docIds returned`,
            );
          }

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

          // Show toast error message
          toast.error(`Failed to upload file ${file.name}`);

          // Clean up: if file was uploaded but failed at later stages, remove it
          if (fileWasUploaded && filePath) {
            try {
              console.log(`Cleaning up uploaded file: ${filePath}`);
              await deleteFile.mutateAsync({ path: filePath });
            } catch (deleteError) {
              console.error(
                `Failed to clean up file ${filePath}:`,
                deleteError,
              );
            }
          }

          // Clean up: if docIds were added but file processing failed, remove from knowledge base
          if (docIds && Array.isArray(docIds) && docIds.length > 0) {
            try {
              console.log(
                `Cleaning up knowledge base entries for docIds:`,
                docIds,
              );
              await removeFromKnowledge.mutateAsync({
                docIds,
                connection: knowledgeIntegration?.connection,
              });
            } catch (removeError) {
              console.error(
                `Failed to clean up knowledge base entries:`,
                removeError,
              );
            }
          }

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
