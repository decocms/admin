import { useState } from "react";
import { UserButton, OrganizationSwitcher } from "@daveyplate/better-auth-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/tools/client";
import { authClient } from "./lib/auth-client";

function TestFetchMcp() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "HTTP" as "HTTP" | "SSE" | "Websocket",
    url: "",
    token: "",
  });

  // Query to list connections
  const query = useQuery({
    queryKey: ["connections"],
    queryFn: () => fetcher.CONNECTION_LIST({}),
  });

  // Mutation to create a connection
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return fetcher.CONNECTION_CREATE({
        name: data.name,
        description: data.description || undefined,
        connection: {
          type: data.type,
          url: data.url,
          token: data.token || undefined,
        },
      });
    },
    onSuccess: () => {
      // Invalidate and refetch connections list
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      // Reset form
      setFormData({
        name: "",
        description: "",
        type: "HTTP",
        url: "",
        token: "",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="w-full max-w-4xl p-6">
      <h2 className="text-2xl font-bold mb-6">Connections Manager</h2>

      {/* Create Connection Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Create New Connection</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border rounded-md"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as "HTTP" | "SSE" | "Websocket",
                })
              }
            >
              <option value="HTTP">HTTP</option>
              <option value="SSE">SSE</option>
              <option value="Websocket">Websocket</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">URL *</label>
            <input
              type="url"
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="https://example.com/mcp"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Token (optional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Bearer token or API key"
              value={formData.token}
              onChange={(e) =>
                setFormData({ ...formData, token: e.target.value })
              }
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "Creating..." : "Create Connection"}
          </button>

          {createMutation.isError && (
            <div className="text-red-600 text-sm">
              Error:{" "}
              {createMutation.error?.message || "Failed to create connection"}
            </div>
          )}

          {createMutation.isSuccess && (
            <div className="text-green-600 text-sm">
              Connection created successfully!
            </div>
          )}
        </form>
      </div>

      {/* Connections List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Existing Connections</h3>

        {query.isLoading && (
          <div className="text-gray-500">Loading connections...</div>
        )}

        {query.isError && (
          <div className="text-red-600">
            Error loading connections: {query.error?.message}
          </div>
        )}

        {query.isSuccess && query.data?.connections.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            No connections yet. Create one above to get started.
          </div>
        )}

        {query.isSuccess && query.data?.connections.length > 0 && (
          <div className="space-y-4">
            {query.data.connections.map((connection) => (
              <div
                key={connection.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-lg">{connection.name}</h4>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      connection.status === "active"
                        ? "bg-green-100 text-green-800"
                        : connection.status === "inactive"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {connection.status}
                  </span>
                </div>
                {connection.description && (
                  <p className="text-gray-600 text-sm mb-2">
                    {connection.description}
                  </p>
                )}
                <div className="flex gap-4 text-sm text-gray-500">
                  <span className="font-medium">
                    {connection.connectionType}
                  </span>
                  <span className="truncate">{connection.connectionUrl}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  ID: {connection.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SignInWithSSO() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Sign In with SSO</h2>
      <button
        onClick={() => {
          authClient.signIn.sso({
            providerId: "microsoft",
            callbackURL: `/`,
          });
        }}
      >
        Sign In with Microsoft
      </button>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Deco CMS Admin - Self Hosted</h1>
          <div className="flex items-center gap-4">
            <OrganizationSwitcher />
            <UserButton />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-8">
        <TestFetchMcp />
      </div>

      <SignInWithSSO />
    </div>
  );
}
