import { useState, useEffect } from "react";
import {
  useListFiles,
  useReadFile,
  usePutFile,
  useDeleteFile,
} from "../hooks/useBranches.ts";
import {
  useWatchBranch,
  type FileChangeEvent,
} from "../hooks/useWatchBranch.ts";
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
  const [watchEnabled, setWatchEnabled] = useState(true);
  const [recentEvents, setRecentEvents] = useState<FileChangeEvent[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const {
    data: filesData,
    isLoading,
    refetch: refetchFiles,
  } = useListFiles(branch);
  const readFile = useReadFile();
  const putFile = usePutFile();
  const deleteFile = useDeleteFile();

  // Watch for branch changes
  const {
    events,
    connectionStatus,
    error: watchError,
    clearEvents,
  } = useWatchBranch({
    branchName: branch,
    enabled: watchEnabled,
  });

  const files = filesData?.files || {};
  const fileList = Object.entries(files);

  // Handle new watch events
  useEffect(() => {
    if (events.length > 0) {
      // Keep only the last 10 events for display
      setRecentEvents((prev) => {
        const newEvents = events.slice(-10);
        return newEvents;
      });

      // Refetch file list when changes occur
      refetchFiles();
    }
  }, [events, refetchFiles]);

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

  const handleDeleteFile = async (filePath: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${filePath}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteFile.mutateAsync({
        branch,
        path: filePath,
      });

      // Close file viewer if deleted file was selected
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setFileContent(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  };

  const handleStartEdit = () => {
    setEditedContent(fileContent || "");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedFile) return;

    try {
      await putFile.mutateAsync({
        branch,
        path: selectedFile,
        content: btoa(editedContent), // Encode as base64
      });

      setFileContent(editedContent);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditedContent("");
    setIsEditing(false);
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
          <div className="flex items-center gap-3">
            <h3 className="font-medium">Files ({fileList.length})</h3>

            {/* Watch Status Indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500"
                    : connectionStatus === "connecting"
                      ? "bg-yellow-500 animate-pulse"
                      : connectionStatus === "error"
                        ? "bg-red-500"
                        : "bg-gray-400"
                }`}
              />
              <span className="text-xs text-gray-500">
                {connectionStatus === "connected"
                  ? "Watching"
                  : connectionStatus === "connecting"
                    ? "Connecting..."
                    : connectionStatus === "error"
                      ? "Connection Error"
                      : "Not Watching"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setWatchEnabled(!watchEnabled)}
                className="h-6 px-2 text-xs"
              >
                {watchEnabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>

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
                className={`border rounded p-3 transition-colors ${
                  selectedFile === path
                    ? "bg-blue-50 border-blue-200"
                    : "hover:bg-gray-50"
                }`}
              >
                <div
                  className="cursor-pointer"
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

                {/* File Actions */}
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileClick(path);
                    }}
                    className="text-xs"
                  >
                    {selectedFile === path ? "Close" : "View"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(path);
                    }}
                    disabled={deleteFile.isPending}
                    className="text-xs"
                  >
                    {deleteFile.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Changes Display */}
        {recentEvents.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Recent Changes ({recentEvents.length})
              <Button
                size="sm"
                variant="ghost"
                onClick={clearEvents}
                className="ml-2 h-5 px-2 text-xs text-blue-600"
              >
                Clear
              </Button>
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentEvents.map((event, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded ${
                    event.type === "added"
                      ? "bg-green-100 text-green-800"
                      : event.type === "modified"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  <span className="font-medium capitalize">{event.type}:</span>{" "}
                  {event.path}
                  {event.metadata && (
                    <span className="ml-2 text-gray-600">
                      ({(event.metadata.sizeInBytes / 1024).toFixed(1)} KB)
                    </span>
                  )}
                  <div className="text-xs opacity-75">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Watch Error Display */}
        {watchError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">
              <strong>Watch Error:</strong> {watchError}
            </p>
          </div>
        )}
      </div>

      {/* File Content Viewer */}
      {selectedFile && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Content: {selectedFile}</h3>
            <div className="flex gap-2">
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEdit}
                  disabled={readFile.isPending || !fileContent}
                >
                  Edit
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setFileContent(null);
                  setIsEditing(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>

          {readFile.isPending ? (
            <div className="flex items-center justify-center p-4">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="ml-2">Loading content...</span>
            </div>
          ) : isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-96 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="File content..."
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={putFile.isPending}
                >
                  {putFile.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={putFile.isPending}
                >
                  Cancel
                </Button>
              </div>
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
