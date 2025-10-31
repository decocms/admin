import { z } from "zod";

/**
 * View Definition Schema
 *
 * This schema defines the structure for views using Resources 2.0
 * Views are React components that are rendered in an iframe with a standardized template.
 *
 * Views can receive input data via props (e.g., from workflow steps, external sources, or direct calls).
 * The optional inputSchema defines the expected shape of this data using JSON Schema format.
 */
export const ViewDefinitionSchema = z.object({
  name: z.string().min(1).describe("The name/title of the view"),
  description: z.string().describe("A brief description of the view's purpose"),
  inputSchema: z
    .object({})
    .passthrough()
    .optional()
    .describe(
      "Optional JSON Schema (draft-07) defining the expected input data structure. " +
        "When provided, this schema documents what props the view expects to receive. " +
        "Useful for: 1) Documenting the view's data contract, 2) Type validation in workflows, " +
        "3) Auto-generating forms or input UIs. Example: { type: 'object', properties: { userId: { type: 'string' }, metrics: { type: 'array' } }, required: ['userId'] }",
    ),
  code: z
    .string()
    .default(`import { useState } from 'react';

export const App = (props) => {
  // Props contain any input data passed to this view (e.g., from a workflow step output)
  // Access your data via: props.yourDataKey
  const [activeTab, setActiveTab] = useState('start');
  
  return (
    <div 
      className="w-full min-h-screen p-6"
      style={{
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)'
      }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div 
          className="border p-8 text-center"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius)'
          }}
        >
          <h1 
            className="text-4xl font-bold mb-3"
            style={{ color: 'var(--card-foreground)' }}
          >
            🎨 Welcome to Your New View
          </h1>
          <p 
            className="text-lg mb-4"
            style={{ color: 'var(--muted-foreground)' }}
          >
            This view is theme-aware and ready for vibecoding!
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <span 
              className="px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: 'var(--success)',
                color: 'var(--success-foreground)',
                borderRadius: 'var(--radius)'
              }}
            >
              React 19
            </span>
            <span 
              className="px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: 'var(--success)',
                color: 'var(--success-foreground)',
                borderRadius: 'var(--radius)'
              }}
            >
              Tailwind CSS 4
            </span>
            <span 
              className="px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: 'var(--success)',
                color: 'var(--success-foreground)',
                borderRadius: 'var(--radius)'
              }}
            >
              Theme Tokens
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 flex-wrap">
          {['start', 'tools', 'examples', 'data'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: activeTab === tab ? 'var(--primary)' : 'var(--secondary)',
                color: activeTab === tab ? 'var(--primary-foreground)' : 'var(--secondary-foreground)',
                borderRadius: 'var(--radius)'
              }}
            >
              {tab === 'start' && '🚀 Get Started'}
              {tab === 'tools' && '🛠️ Platform Tools'}
              {tab === 'examples' && '💡 Examples'}
              {tab === 'data' && '📦 Your Data'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div 
          className="border p-6"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius)'
          }}
        >
          {activeTab === 'start' && (
            <div className="space-y-4">
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: 'var(--card-foreground)' }}
              >
                🚀 Start Vibecoding
              </h2>
              <p style={{ color: 'var(--muted-foreground)' }}>
                Just chat with AI to transform this view. Here are some ideas:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <FeatureCard
                  icon="📊"
                  title="Build Dashboards"
                  description="Create data visualizations with charts, tables, and metrics"
                  example='"Show a dashboard with user statistics"'
                />
                <FeatureCard
                  icon="📝"
                  title="Design Forms"
                  description="Build interactive forms with validation and submission"
                  example='"Create a contact form with email validation"'
                />
                <FeatureCard
                  icon="🔄"
                  title="Connect to Tools"
                  description="Use callTool() to fetch data from any integration"
                  example='"List all agents and show their status"'
                />
                <FeatureCard
                  icon="⚙️"
                  title="Add Interactions"
                  description="Build buttons, modals, tabs, and dynamic UIs"
                  example='"Add a modal to edit user settings"'
                />
              </div>

              <div 
                className="mt-6 p-4 border-l-4"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                  borderColor: 'var(--primary)',
                  borderRadius: 'var(--radius)'
                }}
              >
                <p className="font-semibold mb-2">💡 Pro Tip:</p>
                <p className="text-sm">
                  This view uses <strong>theme tokens</strong> (e.g., var(--primary)) that automatically 
                  adapt when you change your workspace theme. Always use tokens instead of hardcoded colors!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-4">
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: 'var(--card-foreground)' }}
              >
                🛠️ Platform Capabilities
              </h2>
              <p style={{ color: 'var(--muted-foreground)' }}>
                Your views have access to powerful platform features:
              </p>

              <div className="space-y-3 mt-4">
                <ToolCard
                  icon="🔧"
                  title="Call Any Tool"
                  description="Use callTool() to invoke integrations, agents, databases, and workflows"
                  code='await callTool({ integrationId: "i:integration-id", toolName: "TOOL_NAME", input: {} })'
                />
                <ToolCard
                  icon="🤖"
                  title="Trigger Agents"
                  description="Start agent conversations and get AI-powered responses"
                  code='await callTool({ integrationId: "i:agents-management", toolName: "AGENT_RUN", input: { agentId: "..." } })'
                />
                <ToolCard
                  icon="🗄️"
                  title="Query Databases"
                  description="Read and write to your workspace databases"
                  code='await callTool({ integrationId: "i:databases-management", toolName: "DB_QUERY", input: { query: "..." } })'
                />
                <ToolCard
                  icon="⚡"
                  title="Run Workflows"
                  description="Execute workflows and get step outputs"
                  code='await callTool({ integrationId: "i:workflows-management", toolName: "WORKFLOW_RUN", input: { workflowId: "..." } })'
                />
                <ToolCard
                  icon="🔌"
                  title="Connect Integrations"
                  description="Access external APIs and services through MCP integrations"
                  code='await callTool({ integrationId: "i:your-integration", toolName: "YOUR_TOOL", input: { ... } })'
                />
              </div>

              <div 
                className="mt-6 p-4 border"
                style={{
                  backgroundColor: 'var(--muted)',
                  borderColor: 'var(--border)',
                  borderRadius: 'var(--radius)'
                }}
              >
                <p 
                  className="text-sm"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <strong>Note:</strong> To discover available integrations and tools, ask the AI: 
                  "List all integrations" or check the integrations page in your workspace.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'examples' && (
            <div className="space-y-4">
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: 'var(--card-foreground)' }}
              >
                💡 Example Prompts
              </h2>
              <p style={{ color: 'var(--muted-foreground)' }}>
                Try these prompts to see what you can build:
              </p>

              <div className="space-y-2 mt-4">
                <ExamplePrompt
                  category="Data Display"
                  prompt="Create a table showing all users with pagination and search"
                />
                <ExamplePrompt
                  category="Data Display"
                  prompt="Build a card grid displaying integrations with their status badges"
                />
                <ExamplePrompt
                  category="Forms"
                  prompt="Add a multi-step form for user onboarding"
                />
                <ExamplePrompt
                  category="Forms"
                  prompt="Create a settings page with tabs for profile, security, and preferences"
                />
                <ExamplePrompt
                  category="Analytics"
                  prompt="Show a dashboard with line charts for monthly metrics"
                />
                <ExamplePrompt
                  category="Analytics"
                  prompt="Display real-time statistics with auto-refresh every 30 seconds"
                />
                <ExamplePrompt
                  category="Actions"
                  prompt="Add a confirmation dialog before deleting items"
                />
                <ExamplePrompt
                  category="Actions"
                  prompt="Create an admin panel to manage users and permissions"
                />
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: 'var(--card-foreground)' }}
              >
                📦 Input Data
              </h2>
              
              {Object.keys(props).length > 0 ? (
                <div className="space-y-3">
                  <p style={{ color: 'var(--muted-foreground)' }}>
                    This view received the following data via props:
                  </p>
                  <pre 
                    className="p-4 overflow-auto text-sm border"
                    style={{
                      backgroundColor: 'var(--muted)',
                      color: 'var(--muted-foreground)',
                      borderColor: 'var(--border)',
                      borderRadius: 'var(--radius)'
                    }}
                  >
                    {JSON.stringify(props, null, 2)}
                  </pre>
                  <p 
                    className="text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Access this data in your component: <code>props.yourKey</code>
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <div className="text-5xl mb-4">📭</div>
                  <p style={{ color: 'var(--muted-foreground)' }}>
                    No input data received yet
                  </p>
                  <p 
                    className="text-sm max-w-md mx-auto"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Views can receive data from workflows, agents, or when called from other views. 
                    Add an inputSchema to define what data this view expects!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="text-center text-sm p-4 border"
          style={{
            color: 'var(--muted-foreground)',
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius)'
          }}
        >
          <p>
            💬 Start chatting with AI to transform this view | 
            🎨 Uses Basecoat UI patterns | 
            🔄 Auto-adapts to workspace theme
          </p>
        </div>
      </div>
    </div>
  );
};

// Reusable Components with Theme Tokens

function FeatureCard({ icon, title, description, example }) {
  return (
    <div 
      className="p-4 border"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius)'
      }}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 
        className="font-bold mb-2"
        style={{ color: 'var(--card-foreground)' }}
      >
        {title}
      </h3>
      <p 
        className="text-sm mb-3"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {description}
      </p>
      <div 
        className="text-xs p-2 border"
        style={{
          backgroundColor: 'var(--muted)',
          color: 'var(--muted-foreground)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius)'
        }}
      >
        {example}
      </div>
    </div>
  );
}

function ToolCard({ icon, title, description, code }) {
  return (
    <div 
      className="p-4 border"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius)'
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 
            className="font-bold mb-1"
            style={{ color: 'var(--card-foreground)' }}
          >
            {title}
          </h3>
          <p 
            className="text-sm mb-2"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {description}
          </p>
          <code 
            className="text-xs block p-2 overflow-x-auto"
            style={{
              backgroundColor: 'var(--muted)',
              color: 'var(--muted-foreground)',
              borderRadius: 'var(--radius)'
            }}
          >
            {code}
          </code>
        </div>
      </div>
    </div>
  );
}

function ExamplePrompt({ category, prompt }) {
  return (
    <div 
      className="p-3 border-l-4 flex items-start gap-3"
      style={{
        backgroundColor: 'var(--muted)',
        borderColor: 'var(--primary)',
        borderRadius: 'var(--radius)'
      }}
    >
      <span 
        className="flex-shrink-0 mt-0.5"
        style={{ color: 'var(--primary)' }}
      >
        →
      </span>
      <div className="flex-1">
        <span 
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {category}
        </span>
        <p 
          className="text-sm mt-1"
          style={{ color: 'var(--card-foreground)' }}
        >
          "{prompt}"
        </p>
      </div>
    </div>
  );
}`)
    .describe(
      "The React component code for the view. Must define 'export const App = (props) => { ... }'. The App component receives input data as props. Import React hooks from 'react'. The code will be rendered using React 19.2.0, has access to Tailwind CSS v4, and can call tools via the global callTool() function.",
    ),
  importmap: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Optional import map for customizing module resolution. Defaults to React 19.2.0 imports. Example: { 'react': 'https://esm.sh/react@19.2.0', 'lodash': 'https://esm.sh/lodash' }",
    ),
  icon: z
    .string()
    .optional()
    .describe(
      "Optional icon URL for the view. If not provided, a default icon will be used.",
    ),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional tags for categorizing and searching views"),
});

export type ViewDefinition = z.infer<typeof ViewDefinitionSchema>;
