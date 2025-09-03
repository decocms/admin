import { useState } from "react";
import { Button } from "./ui/button";
import { NamespaceSelector } from "./namespace-selector";
import { FileExplorer } from "./file-explorer.tsx";
import {
  useListNamespaces,
  useCreateNamespace,
  useDeleteNamespace,
  useMergeNamespace,
  useDiffNamespace,
  type NamespaceDiff,
  type MergeResult,
} from "../hooks/useNamespaces";

export function NamespaceManager() {
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [newNamespaceName, setNewNamespaceName] = useState("");
  const [sourceNamespace, setSourceNamespace] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Merge/Diff states
  const [targetNamespace, setTargetNamespace] = useState("");
  const [mergeSourceNamespace, setMergeSourceNamespace] = useState("");
  const [diffBaseNamespace, setDiffBaseNamespace] = useState("");
  const [diffCompareNamespace, setDiffCompareNamespace] = useState("");
  const [mergeStrategy, setMergeStrategy] = useState<
    "OVERRIDE" | "LAST_WRITE_WINS"
  >("OVERRIDE");

  // Results
  const [diffResult, setDiffResult] = useState<NamespaceDiff[] | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  const { data: namespacesData, isLoading } = useListNamespaces();
  const createNamespace = useCreateNamespace();
  const deleteNamespace = useDeleteNamespace();
  const mergeNamespace = useMergeNamespace();
  const diffNamespace = useDiffNamespace();

  const namespaces = namespacesData?.namespaces || [];

  const handleCreateNamespace = async () => {
    if (!newNamespaceName.trim()) return;

    try {
      await createNamespace.mutateAsync({
        namespaceName: newNamespaceName.trim(),
        sourceNamespace: sourceNamespace || undefined,
      });
      setNewNamespaceName("");
      setSourceNamespace("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create namespace:", error);
    }
  };

  const handleDeleteNamespace = async (namespaceName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete namespace "${namespaceName}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteNamespace.mutateAsync({ namespaceName });
      if (selectedNamespace === namespaceName) {
        setSelectedNamespace("");
      }
    } catch (error) {
      console.error("Failed to delete namespace:", error);
    }
  };

  const handleMergeNamespace = async () => {
    if (!mergeSourceNamespace) return;

    try {
      const result = await mergeNamespace.mutateAsync({
        targetNamespace: targetNamespace || "main",
        sourceNamespace: mergeSourceNamespace,
        strategy: mergeStrategy,
      });
      setMergeResult(result);
    } catch (error) {
      console.error("Failed to merge namespace:", error);
    }
  };

  const handleDiffNamespace = async () => {
    if (!diffCompareNamespace) return;

    try {
      const result = await diffNamespace.mutateAsync({
        baseNamespace: diffBaseNamespace || "main",
        compareNamespace: diffCompareNamespace,
      });
      setDiffResult(result.differences);
    } catch (error) {
      console.error("Failed to diff namespace:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="ml-2">Loading namespaces...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Namespace Manager</h1>

      {/* Namespace List */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Namespaces</h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {namespaces.map((namespace) => (
            <div key={namespace.name} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{namespace.name}</h3>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteNamespace(namespace.name)}
                  disabled={deleteNamespace.isPending}
                >
                  Delete
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Created: {new Date(namespace.createdAt).toLocaleDateString()}
              </p>
              {namespace.originNamespace && (
                <p className="text-sm text-gray-500">
                  Branched from: {namespace.originNamespace}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedNamespace(namespace.name)}
                className="w-full"
              >
                View Files
              </Button>
            </div>
          ))}
        </div>

        {/* Create Namespace */}
        <div className="mt-6 border-t pt-4">
          {!isCreating ? (
            <Button onClick={() => setIsCreating(true)}>
              Create New Namespace
            </Button>
          ) : (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Namespace Name
                </label>
                <input
                  type="text"
                  value={newNamespaceName}
                  onChange={(e) => setNewNamespaceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Enter namespace name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Source Namespace (optional)
                </label>
                <NamespaceSelector
                  value={sourceNamespace}
                  onValueChange={setSourceNamespace}
                  placeholder="Select source namespace to branch from"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleCreateNamespace}
                  disabled={
                    !newNamespaceName.trim() || createNamespace.isPending
                  }
                >
                  {createNamespace.isPending ? "Creating..." : "Create"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewNamespaceName("");
                    setSourceNamespace("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merge Operations */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Merge Namespaces</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Target Namespace (will receive changes)
            </label>
            <NamespaceSelector
              value={targetNamespace}
              onValueChange={setTargetNamespace}
              placeholder="Target namespace (defaults to 'main')"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Source Namespace (changes to merge)
            </label>
            <NamespaceSelector
              value={mergeSourceNamespace}
              onValueChange={setMergeSourceNamespace}
              placeholder="Select source namespace"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">
            Merge Strategy
          </label>
          <select
            value={mergeStrategy}
            onChange={(e) =>
              setMergeStrategy(e.target.value as "OVERRIDE" | "LAST_WRITE_WINS")
            }
            className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="OVERRIDE">Override</option>
            <option value="LAST_WRITE_WINS">Last Write Wins</option>
          </select>
        </div>

        <Button
          onClick={handleMergeNamespace}
          disabled={!mergeSourceNamespace || mergeNamespace.isPending}
          className="mt-4"
        >
          {mergeNamespace.isPending ? "Merging..." : "Merge Namespaces"}
        </Button>

        {mergeResult && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="font-medium text-green-800">
              Merge completed successfully!
            </p>
            <p className="text-sm text-green-700">
              Files merged: {mergeResult.filesMerged} | Added:{" "}
              {mergeResult.added.length} | Modified:{" "}
              {mergeResult.modified.length} | Deleted:{" "}
              {mergeResult.deleted.length}
            </p>
          </div>
        )}
      </div>

      {/* Diff Operations */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Compare Namespaces</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Base Namespace
            </label>
            <NamespaceSelector
              value={diffBaseNamespace}
              onValueChange={setDiffBaseNamespace}
              placeholder="Base namespace (defaults to 'main')"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Compare Namespace
            </label>
            <NamespaceSelector
              value={diffCompareNamespace}
              onValueChange={setDiffCompareNamespace}
              placeholder="Select namespace to compare"
            />
          </div>
        </div>

        <Button
          onClick={handleDiffNamespace}
          disabled={!diffCompareNamespace || diffNamespace.isPending}
          className="mt-4"
        >
          {diffNamespace.isPending ? "Comparing..." : "Compare Namespaces"}
        </Button>

        {diffResult && (
          <div className="mt-4 space-y-2">
            <h3 className="font-medium">Differences ({diffResult.length})</h3>
            <div className="max-h-64 overflow-y-auto border rounded p-2">
              {diffResult.length === 0 ? (
                <p className="text-gray-500">No differences found</p>
              ) : (
                diffResult.map((diff, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 text-sm"
                  >
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        diff.type === "added"
                          ? "bg-green-100 text-green-800"
                          : diff.type === "modified"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {diff.type.toUpperCase()}
                    </span>
                    <span>{diff.path}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* File Explorer */}
      {selectedNamespace && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Files in "{selectedNamespace}"
            </h2>
            <Button variant="outline" onClick={() => setSelectedNamespace("")}>
              Close
            </Button>
          </div>

          <FileExplorer namespace={selectedNamespace} />
        </div>
      )}
    </div>
  );
}
