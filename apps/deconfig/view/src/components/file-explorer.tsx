import { useState } from "react";
import { useListFiles, useReadFile, usePutFile } from "../hooks/useBranches.ts";
import { Button } from "./ui/button";

interface FileExplorerProps {
  branch: string;
}

export function FileExplorer({ branch }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");

  const { data: filesData, isLoading } = useListFiles(branch);
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

    try {
      setSelectedFile(filePath);
      const result = await readFile.mutateAsync({
        branch,
        path: filePath,
      });

      // Decode base64 content
      const decodedContent = atob(result.content);
      setFileContent(decodedContent);
    } catch (error) {
      console.error("Failed to read file:", error);
      setFileContent("Error reading file");
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;

    try {
      await putFile.mutateAsync({
        branch,
        path: newFileName.trim(),
        content: btoa(newFileContent), // Encode as base64
      });

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
        <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="ml-2">Loading files...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* File List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Files ({fileList.length})</h3>
          <Button
            size="sm"
            onClick={() => setIsCreating(!isCreating)}
            variant={isCreating ? "secondary" : "default"}
          >
            {isCreating ? "Cancel" : "New File"}
          </Button>
        </div>

        {/* Create File Form */}
        {isCreating && (
          <div className="mb-4 p-3 border rounded bg-gray-50 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                File Path
              </label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. config/settings.json"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="File content..."
              />
            </div>

            <Button
              onClick={handleCreateFile}
              disabled={!newFileName.trim() || putFile.isPending}
              size="sm"
            >
              {putFile.isPending ? "Creating..." : "Create File"}
            </Button>
          </div>
        )}

        {fileList.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No files in this branch
          </p>
        ) : (
          <div className="space-y-2">
            {fileList.map(([path, metadata]) => (
              <div
                key={path}
                className={`border rounded p-3 cursor-pointer transition-colors ${
                  selectedFile === path
                    ? "bg-blue-50 border-blue-200"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => handleFileClick(path)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{path}</span>
                  <span className="text-sm text-gray-500">
                    {(metadata.sizeInBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Modified: {new Date(metadata.mtime).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Content Viewer */}
      {selectedFile && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Content: {selectedFile}</h3>
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
            <div className="flex items-center justify-center p-4">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="ml-2">Loading content...</span>
            </div>
          ) : (
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {fileContent}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
