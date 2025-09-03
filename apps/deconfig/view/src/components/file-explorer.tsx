import { useState } from "react";
import {
  useListFiles,
  useReadFile,
  usePutFile,
} from "../hooks/useNamespaces.ts";
import { Button } from "./ui/button";

interface FileExplorerProps {
  namespace: string;
}

export function FileExplorer({ namespace }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");

  const { data: filesData, isLoading } = useListFiles(namespace);
  const readFile = useReadFile();
  const putFile = usePutFile();

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

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;

    try {
      // Encode content as base64
      const encodedContent = btoa(newFileContent);

      await putFile.mutateAsync({
        namespace,
        path: newFileName.trim(),
        content: encodedContent,
      });

      // Reset form
      setNewFileName("");
      setNewFileContent("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create file:", error);
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

  return (
    <div className="space-y-4">
      {/* Add File Button - Always visible */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Files</h3>
        <Button
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
          className="flex items-center space-x-2"
        >
          <span className="text-lg">+</span>
          <span>Add File</span>
        </Button>
      </div>

      {/* Create File Form */}
      {isCreating && (
        <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
          <h4 className="font-medium">Create New File</h4>

          <div>
            <label className="block text-sm font-medium mb-1">File Path</label>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="e.g., config.json, docs/readme.md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              File Content
            </label>
            <textarea
              value={newFileContent}
              onChange={(e) => setNewFileContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono text-sm"
              rows={10}
              placeholder="Enter file content..."
            />
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleCreateFile}
              disabled={!newFileName.trim() || putFile.isPending}
            >
              {putFile.isPending ? "Creating..." : "Create File"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setNewFileName("");
                setNewFileContent("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="grid gap-2">
        {fileList.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            No files found in this namespace
          </div>
        ) : (
          fileList.map(([filePath, fileInfo]) => (
            <div
              key={filePath}
              className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${
                selectedFile === filePath ? "bg-blue-50 border-blue-200" : ""
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
                <span>
                  Modified: {new Date(fileInfo.mtime).toLocaleString()}
                </span>
                <span>
                  Created: {new Date(fileInfo.ctime).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
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
