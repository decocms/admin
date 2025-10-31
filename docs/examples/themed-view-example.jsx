/**
 * Themed View Example
 *
 * This example demonstrates how to create a theme-aware view that automatically
 * adapts to workspace theme changes using design tokens.
 *
 * Features demonstrated:
 * - Using theme tokens for consistent styling
 * - Semantic token usage (primary, destructive, success, warning)
 * - Responsive design with Tailwind CSS
 * - Component patterns inspired by Basecoat UI
 * - Proper accessibility with focus states
 */

import { useState, useEffect } from "react";

export const App = (props) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Example: Fetch data using callTool (global function, always available)
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await callTool({
        integrationId: "i:integration-management",
        toolName: "INTEGRATIONS_LIST",
        input: {},
      });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div
      className="min-h-screen p-6"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Card */}
        <div
          className="border p-6"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: "var(--card-foreground)" }}
          >
            Themed Dashboard
          </h1>
          <p style={{ color: "var(--muted-foreground)" }}>
            This view automatically adapts to your workspace theme
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Total Items"
            value={data?.integrations?.length || 0}
            icon="📦"
          />
          <StatCard
            label="Active"
            value={data?.integrations?.filter((i) => i.enabled).length || 0}
            icon="✓"
          />
          <StatCard
            label="Disabled"
            value={data?.integrations?.filter((i) => !i.enabled).length || 0}
            icon="○"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: "var(--radius)",
            }}
          >
            {loading ? "Loading..." : "Refresh Data"}
          </button>

          <button
            className="px-4 py-2 font-medium border transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--secondary)",
              color: "var(--secondary-foreground)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius)",
            }}
          >
            Export
          </button>

          <button
            className="px-4 py-2 font-medium border transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--destructive)",
              color: "var(--destructive-foreground)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius)",
            }}
          >
            Clear Cache
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {data && !error && (
          <Alert type="success" message="Data loaded successfully!" />
        )}

        {/* Data Table */}
        {data && (
          <div
            className="border overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius)",
            }}
          >
            <table className="w-full">
              <thead
                style={{
                  backgroundColor: "var(--muted)",
                }}
              >
                <tr>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Name
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Status
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.integrations?.slice(0, 10).map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--card-foreground)" }}
                    >
                      {item.name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={item.enabled ? "active" : "inactive"}
                      />
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {item.type || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Reusable StatCard component with theme tokens
 */
function StatCard({ label, value, icon }) {
  return (
    <div
      className="border p-4"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <div
          className="text-3xl font-bold"
          style={{ color: "var(--card-foreground)" }}
        >
          {value}
        </div>
      </div>
      <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
    </div>
  );
}

/**
 * Reusable StatusBadge component with semantic token usage
 */
function StatusBadge({ status }) {
  const configs = {
    active: {
      bg: "var(--success)",
      fg: "var(--success-foreground)",
      label: "Active",
    },
    inactive: {
      bg: "var(--muted)",
      fg: "var(--muted-foreground)",
      label: "Inactive",
    },
    warning: {
      bg: "var(--warning)",
      fg: "var(--warning-foreground)",
      label: "Warning",
    },
    error: {
      bg: "var(--destructive)",
      fg: "var(--destructive-foreground)",
      label: "Error",
    },
  };

  const config = configs[status] || configs.inactive;

  return (
    <span
      className="px-3 py-1 text-xs font-medium inline-block"
      style={{
        backgroundColor: config.bg,
        color: config.fg,
        borderRadius: "var(--radius)",
      }}
    >
      {config.label}
    </span>
  );
}

/**
 * Reusable Alert component with semantic token usage
 */
function Alert({ type = "info", message, onDismiss }) {
  const configs = {
    success: {
      bg: "var(--success)",
      fg: "var(--success-foreground)",
      icon: "✓",
    },
    error: {
      bg: "var(--destructive)",
      fg: "var(--destructive-foreground)",
      icon: "✕",
    },
    warning: {
      bg: "var(--warning)",
      fg: "var(--warning-foreground)",
      icon: "⚠",
    },
    info: {
      bg: "var(--accent)",
      fg: "var(--accent-foreground)",
      icon: "ℹ",
    },
  };

  const config = configs[type] || configs.info;

  return (
    <div
      className="p-4 border flex items-start justify-between gap-3"
      style={{
        backgroundColor: config.bg,
        color: config.fg,
        borderColor: "var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{config.icon}</span>
        <div className="flex-1">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xl leading-none hover:opacity-70 transition-opacity"
          style={{ color: config.fg }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
