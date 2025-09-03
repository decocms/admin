import { useListNamespaces } from "../hooks/useNamespaces.ts";

interface NamespaceSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NamespaceSelector({
  value,
  onValueChange,
  placeholder = "Select namespace...",
  disabled = false,
}: NamespaceSelectorProps) {
  const { data: namespacesData, isLoading } = useListNamespaces();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading namespaces...</span>
      </div>
    );
  }

  const namespaces = namespacesData?.namespaces || [];

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
      {namespaces.map((namespace) => (
        <option key={namespace.name} value={namespace.name}>
          {namespace.name}
          {namespace.originNamespace && ` (from ${namespace.originNamespace})`}
        </option>
      ))}
    </select>
  );
}
