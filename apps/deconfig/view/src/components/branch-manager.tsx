import { useState } from "react";
import { Button } from "./ui/button";
import { BranchSelector } from "./branch-selector";
import { FileExplorer } from "./file-explorer.tsx";
import {
  useListBranches,
  useCreateBranch,
  useDeleteBranch,
  useMergeBranch,
  useDiffBranch,
  type BranchDiff,
  type MergeResult,
} from "../hooks/useBranches";

export function BranchManager() {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [newBranchName, setNewBranchName] = useState("");
  const [sourceBranch, setSourceBranch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Merge/Diff states
  const [targetBranch, setTargetBranch] = useState("");
  const [mergeSourceBranch, setMergeSourceBranch] = useState("");
  const [diffBaseBranch, setDiffBaseBranch] = useState("");
  const [diffCompareBranch, setDiffCompareBranch] = useState("");
  const [mergeStrategy, setMergeStrategy] = useState<
    "OVERRIDE" | "LAST_WRITE_WINS"
  >("OVERRIDE");

  // Results
  const [diffResult, setDiffResult] = useState<BranchDiff[] | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  const { data: branchesData, isLoading } = useListBranches();
  const createBranch = useCreateBranch();
  const deleteBranch = useDeleteBranch();
  const mergeBranch = useMergeBranch();
  const diffBranch = useDiffBranch();

  const branches = branchesData?.branches || [];

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    try {
      await createBranch.mutateAsync({
        branchName: newBranchName.trim(),
        sourceBranch: sourceBranch || undefined,
      });
      setNewBranchName("");
      setSourceBranch("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create branch:", error);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete branch "${branchName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteBranch.mutateAsync({ branchName });
    } catch (error) {
      console.error("Failed to delete branch:", error);
    }
  };

  const handleMergeBranch = async () => {
    if (!targetBranch || !mergeSourceBranch) return;

    try {
      const result = await mergeBranch.mutateAsync({
        targetBranch,
        sourceBranch: mergeSourceBranch,
        strategy: mergeStrategy,
      });
      setMergeResult(result);
    } catch (error) {
      console.error("Failed to merge branches:", error);
    }
  };

  const handleDiffBranch = async () => {
    if (!diffBaseBranch || !diffCompareBranch) return;

    try {
      const result = await diffBranch.mutateAsync({
        baseBranch: diffBaseBranch,
        compareBranch: diffCompareBranch,
      });
      setDiffResult(result.differences);
    } catch (error) {
      console.error("Failed to diff branches:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="h-8 w-8 border-4 border-current border-t-transparent rounded-full animate-spin" />
        <span className="ml-2">Loading branches...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Branch Manager</h1>

      {/* Branch List */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Branches</h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div key={branch.name} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{branch.name}</h3>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteBranch(branch.name)}
                  disabled={deleteBranch.isPending}
                >
                  Delete
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Created: {new Date(branch.createdAt).toLocaleDateString()}
              </p>
              {branch.originBranch && (
                <p className="text-sm text-gray-500">
                  Branched from: {branch.originBranch}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedBranch(branch.name)}
                className="w-full"
              >
                View Files
              </Button>
            </div>
          ))}
        </div>

        {/* Create Branch */}
        <div className="mt-6 border-t pt-4">
          <Button
            onClick={() => setIsCreating(!isCreating)}
            className="mb-4"
            variant={isCreating ? "secondary" : "default"}
          >
            {isCreating ? "Cancel" : "Create New Branch"}
          </Button>

          {isCreating && (
            <div className="space-y-4 bg-gray-50 p-4 rounded">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter branch name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Source Branch (optional)
                </label>
                <BranchSelector
                  value={sourceBranch}
                  onValueChange={setSourceBranch}
                  placeholder="Select source branch to branch from..."
                />
              </div>

              <Button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim() || createBranch.isPending}
              >
                {createBranch.isPending ? "Creating..." : "Create Branch"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Merge Branches */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Merge Branches</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Target Branch
            </label>
            <BranchSelector
              value={targetBranch}
              onValueChange={setTargetBranch}
              placeholder="Select target branch..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Source Branch
            </label>
            <BranchSelector
              value={mergeSourceBranch}
              onValueChange={setMergeSourceBranch}
              placeholder="Select source branch..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Merge Strategy
            </label>
            <select
              value={mergeStrategy}
              onChange={(e) =>
                setMergeStrategy(
                  e.target.value as "OVERRIDE" | "LAST_WRITE_WINS",
                )
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="OVERRIDE">Override</option>
              <option value="LAST_WRITE_WINS">Last Write Wins</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleMergeBranch}
              disabled={
                !targetBranch || !mergeSourceBranch || mergeBranch.isPending
              }
              className="w-full"
            >
              {mergeBranch.isPending ? "Merging..." : "Merge Branches"}
            </Button>
          </div>
        </div>

        {mergeResult && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <h3 className="font-medium text-green-800">Merge Successful</h3>
            <p className="text-sm text-green-700">
              Files merged: {mergeResult.filesMerged}, Added:{" "}
              {mergeResult.added.length}, Modified:{" "}
              {mergeResult.modified.length}, Deleted:{" "}
              {mergeResult.deleted.length}
            </p>
            {mergeResult.conflicts && mergeResult.conflicts.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-yellow-800">
                  Conflicts resolved: {mergeResult.conflicts.length}
                </p>
                <ul className="text-xs text-yellow-700 mt-1">
                  {mergeResult.conflicts.map((conflict, i) => (
                    <li key={i}>
                      {conflict.path} - {conflict.resolved}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diff Branches */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Compare Branches</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Base Branch
            </label>
            <BranchSelector
              value={diffBaseBranch}
              onValueChange={setDiffBaseBranch}
              placeholder="Select base branch..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Compare Branch
            </label>
            <BranchSelector
              value={diffCompareBranch}
              onValueChange={setDiffCompareBranch}
              placeholder="Select compare branch..."
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleDiffBranch}
              disabled={
                !diffBaseBranch || !diffCompareBranch || diffBranch.isPending
              }
              className="w-full"
            >
              {diffBranch.isPending ? "Comparing..." : "Compare"}
            </Button>
          </div>
        </div>

        {diffResult && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">
              Differences ({diffResult.length} files)
            </h3>
            {diffResult.length === 0 ? (
              <p className="text-sm text-gray-500">No differences found.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {diffResult.map((diff, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded text-sm ${
                      diff.type === "added"
                        ? "bg-green-50 text-green-800"
                        : diff.type === "modified"
                          ? "bg-yellow-50 text-yellow-800"
                          : "bg-red-50 text-red-800"
                    }`}
                  >
                    <span className="font-medium capitalize">{diff.type}:</span>{" "}
                    {diff.path}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Explorer */}
      {selectedBranch && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Files in "{selectedBranch}"
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedBranch("")}
            >
              Close
            </Button>
          </div>
          <FileExplorer branch={selectedBranch} />
        </div>
      )}
    </div>
  );
}
