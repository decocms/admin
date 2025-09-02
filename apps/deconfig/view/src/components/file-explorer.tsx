import { useState } from "react";
import { useListFiles, useReadFile } from "../hooks/useNamespaces.tsx";
import { Button } from "./ui/button";

interface FileExplorerProps {
  namespace: string;
}

export function FileExplorer({ namespace }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  const { data: filesData, isLoading } = useListFiles(namespace);
  const readFile = useReadFile();

  const files = filesData?.files || {};
  const fileList = Object.entries(files);

  const handleFileClick = async (filePath: string) => {
    if (selectedFile === filePath) {
      setSelectedFile(null);
      setFileContent(null);
      return;
    }

    setSelectedFile(filePath);
    setFileContent(null);

    try {
      const result = await readFile.mutateAsync({
        namespace,
        path: filePath,
      });

      // Decode base64 content
      const decodedContent = atob(result.content);
      setFileContent(decodedContent);
    } catch (error) {
      console.error("Failed to read file:", error);
      setFileContent("Error: Failed to read file content");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="ml-2">Loading files...</span>
      </div>
    );
  }

  if (fileList.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No files found in this namespace
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* File List */}
      <div className="grid gap-2">
        {fileList.map(([filePath, fileInfo]) => (
          <div
            key={filePath}
            className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${selectedFile === filePath ? "bg-blue-50 border-blue-200" : ""
              }`}
            onClick={() => handleFileClick(filePath)}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{filePath}</h4>
              <span className="text-sm text-gray-500">
                {Math.round(fileInfo.sizeInBytes / 1024)}KB
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
              <span>Modified: {new Date(fileInfo.mtime).toLocaleString()}</span>
              <span>Created: {new Date(fileInfo.ctime).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* File Content */}
      {selectedFile && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Content of: {selectedFile}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                setFileContent(null);
              }}
            >
              Close
            </Button>
          </div>

          {readFile.isPending ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="ml-2">Loading file content...</span>
            </div>
          ) : (
            <div className="bg-gray-50 border rounded p-3 max-h-96 overflow-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {fileContent || "No content available"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 