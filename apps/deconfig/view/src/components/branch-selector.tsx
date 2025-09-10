import { useListBranches } from "../hooks/useBranches.ts";

interface BranchSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BranchSelector({
  value,
  onValueChange,
  placeholder = "Select branch...",
  disabled = false,
}: BranchSelectorProps) {
  const { data: branchesData, isLoading } = useListBranches();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading branches...</span>
      </div>
    );
  }

  const branches = branchesData?.branches || [];

  return (
    <select
      value={value || ""}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {branches.map((branch) => (
        <option key={branch.name} value={branch.name}>
          {branch.name}
          {branch.originBranch && ` (from ${branch.originBranch})`}
        </option>
      ))}
    </select>
  );
}
