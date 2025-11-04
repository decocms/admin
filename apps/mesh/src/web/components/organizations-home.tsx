import { authClient } from "../lib/auth-client";

export function OrganizationsHome() {
  const {
    data: organizations,
    isPending,
    error,
  } = authClient.useListOrganizations();

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 text-lg">Loading organizations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600 text-lg">
          Error loading organizations: {error.message}
        </div>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            No organizations yet
          </h2>
          <p className="text-gray-500">
            Create your first organization to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h2 className="text-3xl font-bold mb-8">Your Organizations</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <div
            key={org.id}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer border border-gray-200"
          >
            {org.logo && (
              <div className="mb-4">
                <img
                  src={org.logo}
                  alt={org.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              </div>
            )}
            <h3 className="text-xl font-semibold mb-2">{org.name}</h3>
            <p className="text-sm text-gray-500 mb-4">@{org.slug}</p>
            {org.metadata && (
              <div className="text-xs text-gray-400 mb-2">
                {JSON.stringify(org.metadata)}
              </div>
            )}
            <div className="text-xs text-gray-400">
              Created:{" "}
              {new Date(org.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
