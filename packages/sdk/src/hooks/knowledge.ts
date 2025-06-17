import { useMutation } from "@tanstack/react-query";
import { useSDK } from "./index.ts";
import {
  addFileToKnowledge,
  createKnowledge,
  removeFromKnowledge,
} from "../crud/knowledge.ts";
import type { Integration } from "../index.ts";

interface ForConnection {
  connection?: Integration["connection"];
}

export const useCreateKnowledge = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ name }: {
      name: string;
    }) => createKnowledge({ workspace, name }),
  });
};

interface AddFileToKnowledgeParams extends ForConnection {
  fileUrl: string;
  path: string;
  metadata?: Record<string, string>;
}

export const useAddFileToKnowledge = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: (
      { fileUrl, metadata, path, connection }: AddFileToKnowledgeParams,
    ) => addFileToKnowledge({ workspace, fileUrl, metadata, path, connection }),
  });
};

interface RemoveFileFileKnowledgeParams extends ForConnection {
  docIds: string[];
}

export const useRemoveFromKnowledge = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ docIds, connection }: RemoveFileFileKnowledgeParams) =>
      removeFromKnowledge({ workspace, docIds, connection }),
  });
};
