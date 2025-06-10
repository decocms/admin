import { Dispatch, SetStateAction, useMemo, useRef, useState } from "react";
import {
  type Agent,
  type Integration,
  useAddFileToKnowledge,
  useDeleteFile,
  useFiles,
  useReadFile,
  useRemoveFromKnowledge,
  useWriteFile,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  FormDescription,
  FormItem,
  FormLabel,
} from "@deco/ui/components/form.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useAgentSettingsForm } from "./edit.tsx";
import { useAgentKnowledgeIntegration } from "./hooks/use-agent-knowledge.ts";
import { extname } from "@std/path/posix";

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const agentKnowledgeBasePath = (agentId: string) =>
  `agent/${agentId}/knowledge`;
const agentKnowledgeBaseFilepath = (agentId: string, path: string) =>
  `${agentKnowledgeBasePath(agentId)}/${path}`;
const useAgentKnowledgeRootPath = (agentId: string) =>
  useMemo(() => agentKnowledgeBasePath(agentId), [agentId]);
const useAgentFiles = (agentId: string) => {
  const prefix = useAgentKnowledgeRootPath(agentId);
  return useFiles({ root: prefix });
};

function FileIcon({ filename }: { filename: string }) {
  const ext = useMemo(() => extname(filename).substring(1), [filename]);
  const color = useMemo(() => {
    switch (ext) {
      case "txt":
      case "md":
        return "text-blue-600";
      case "csv":
        return "text-green-600";
      case "pdf":
        return "text-red-600";
      case "json":
        return "text-yellow-600";
    }
  }, [ext]);

  return (
    <span className="relative w-6 flex items-center justify-center">
      <svg width={24} height={24}>
        <use href="/img/sheet.svg" />
      </svg>
      <span className={cn("mt-2 absolute uppercase text-[6px] spacing", color)}>
        {ext}
      </span>
    </span>
  );
}

interface KnowledgeBaseFileListProps {
  integration?: Integration;
  agentId: string;
  files: {
    name: string;
    type: string;
    uploading?: boolean;
    size?: number;
    file_url?: string;
    docIds?: string[];
  }[];
}

function KnowledgeBaseFileList(
  { files, agentId, integration }: KnowledgeBaseFileListProps,
) {
  const prefix = agentKnowledgeBasePath(agentId);
  const removeFile = useDeleteFile();
  const removeFromKnowledge = useRemoveFromKnowledge();

  if (files.length === 0) return null;

  return (
    <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
      {files.map((file) => (
        <div
          key={file.file_url ?? file.name}
          className="flex items-center gap-3 justify-between p-2 h-14"
        >
          {/* icon */}
          <div className="w-10 h-10 p-2 rounded bg-primary/10 flex-shrink-0">
            {file.uploading
              ? (
                <Icon
                  name="hourglass_empty"
                  size={24}
                  className="text-primary animate-spin"
                />
              )
              : <FileIcon filename={file.file_url ?? file.name} />}
          </div>

          {/* name */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate">
              {file.name}
            </span>
            <div className="flex items-center gap-2">
              {file.size && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              )}
              {file.uploading && (
                <span className="text-xs text-primary">
                  Uploading...
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0"
                disabled={!file.file_url}
              >
                <Icon name="more_horiz" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  file.file_url &&
                    removeFile.mutateAsync({
                      root: prefix,
                      path: file.file_url,
                    });
                  file.docIds &&
                    removeFromKnowledge.mutateAsync({
                      docIds: file.docIds,
                      connection: integration?.connection,
                    });
                }}
                className="text-destructive focus:text-destructive"
              >
                <Icon name="delete" size={16} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}

function AgentKnowledgeBaseFileList(
  { agentId, integration }: { agentId: string; integration?: Integration },
) {
  const { data: files } = useAgentFiles(agentId);
  const prefix = useAgentKnowledgeRootPath(agentId);
  const formatedFiles = useMemo(() =>
    files
      ? files.map((file) => ({
        file_url: file.file_url,
        name: file.file_url.replace(prefix + "/", ""),
        type: file.metadata?.type as string ?? "",
        docIds: file.metadata?.docIds as string[] ?? [] as string[],
      }))
      : [], [prefix, files]);

  return (
    <KnowledgeBaseFileList
      agentId={agentId}
      files={formatedFiles}
      integration={integration}
    />
  );
}

interface UploadFile {
  file: File;
  file_url?: string;
  uploading?: boolean;
  docIds?: string[];
}

interface AddFileToKnowledgeProps {
  agent: Agent;
  onAddFile: Dispatch<SetStateAction<UploadFile[]>>;
}

function AddFileToKnowledge({ agent, onAddFile }: AddFileToKnowledgeProps) {
  const { refetch: refetchAgentKnowledgeFiles } = useAgentFiles(agent.id);
  const [isUploading, setIsUploading] = useState(false);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  const writeFileMutation = useWriteFile();
  const addFileToKnowledgeBase = useAddFileToKnowledge();
  const readFile = useReadFile();
  const { integration: knowledgeIntegration, createAgentKnowledge } =
    useAgentKnowledgeIntegration(
      agent,
    );

  const uploadKnowledgeFiles = async (files: File[]) => {
    setIsUploading(true);

    try {
      // Upload each file using the writeFileMutation
      const uploadPromises = files.map(async (file) => {
        try {
          const filename = file.name;
          const path = agentKnowledgeBaseFilepath(agent.id, filename);
          const buffer = await file.arrayBuffer();

          // add filesize at metadata
          const fileMetadata = {
            agentId: agent.id,
            type: file.type,
          };

          const fileMutateData = {
            path,
            contentType: file.type || "application/octet-stream",
            content: new Uint8Array(buffer),
            metadata: fileMetadata,
          };

          // add metadata
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
            // TODO delete file
            return;
          }

          // TODO: get knowledge based by id like `agent-${id}` or create
          const content = await addFileToKnowledgeBase.mutateAsync({
            connection: knowledgeIntegration?.connection,
            fileUrl,
            metadata: {
              path,
            },
            path,
          });

          // TODO: fix this when forContext is fixed the return
          const docIds = (content as any).docIds ??
            (content as any)?.structuredContent?.docIds;

          await writeFileMutation.mutateAsync({
            ...fileMutateData,
            skipWrite: true,
            metadata: {
              ...fileMetadata,
              docIds,
            },
          });

          // Update the file object with the URL and remove uploading status
          onAddFile((prev) =>
            prev.filter((fileObj) => {
              return fileObj.file !== file;
            })
          );

          return { file, url: path };
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);

          // Remove failed upload from the list
          onAddFile((prev) => prev.filter((fileObj) => fileObj.file !== file));

          throw error;
        }
      });

      await Promise.all(uploadPromises);
      await refetchAgentKnowledgeFiles();
      console.log("All files uploaded successfully");
    } catch (error) {
      console.error("Failed to upload some knowledge files:", error);
      alert("Failed to upload some files. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    knowledgeFileInputRef.current?.click();
  };

  const handleFiles = async (files: File[]) => {
    // Filter for supported file types - only pdf, txt, md, csv, json
    const supportedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
    ];

    const validFiles = files.filter((file) => {
      const isValidType = supportedTypes.includes(file.type);
      const isValidExtension = file.name.endsWith(".pdf") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".json");
      return isValidType || isValidExtension;
    });

    if (validFiles.length !== files.length) {
      alert(
        "Some files were skipped. Only PDF, TXT, MD, CSV, and JSON files are supported.",
      );
    }

    if (validFiles.length > 0) {
      // Add files to state with uploading status
      const fileObjects = validFiles.map((file) => ({ file, uploading: true }));
      onAddFile((prev) => [...prev, ...fileObjects]);

      // Upload files
      if (!knowledgeIntegration) {
        await createAgentKnowledge();
      }
      await uploadKnowledgeFiles(validFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };
  return (
    <div>
      <input
        type="file"
        ref={knowledgeFileInputRef}
        multiple
        accept=".pdf,.txt,.md,.csv,.json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <Button
        type="button"
        variant="outline"
        onClick={triggerFileInput}
        disabled={isUploading}
      >
        <Icon
          name={isUploading ? "hourglass_empty" : "add"}
          size={16}
        />
        Add file
      </Button>

      {
        /*<p className="text-xs text-muted-foreground mt-2 text-center">
        Supports: PDF, TXT, MD, CSV, JSON
      </p>*/
      }
    </div>
  );
}

export default function UploadKnowledgeBaseAsset() {
  const { agent } = useAgentSettingsForm();
  const [uploadedFiles, setUploadedFiles] = useState<
    { file: File; file_url?: string; uploading?: boolean; docIds?: string[] }[]
  >([]);

  return (
    <FormItem>
      <div className="flex items-center gap-2">
        <div className="grow flex flex-col gap-2">
          <FormLabel>Knowledge</FormLabel>
          <FormDescription className="text-xs text-muted-foreground">
            Directly attach files to the assistant knowledge
          </FormDescription>
        </div>

        <AddFileToKnowledge agent={agent} onAddFile={setUploadedFiles} />
      </div>
      <AgentKnowledgeBaseFileList agentId={agent.id} />

      <div className="space-y-4">
        {/* Uploaded Files List */}
        <KnowledgeBaseFileList
          agentId={agent.id}
          files={uploadedFiles.map(({ file, uploading, file_url, docIds }) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            file_url: file_url,
            uploading,
            docIds,
          }))}
        />
      </div>
    </FormItem>
  );
}
