/**
 * Determines if the application should use local backend services.
 *
 * By default, LOCAL_DEBUGGER will be false.
 * If the environment variable VITE_USE_LOCAL_BACKEND is set to 'true',
 * it will use the localhost version.
 */

import { pickCapybaraAvatar, withImageOptimizeUrl } from "@deco/ai/capybaras";
import type { Agent } from "./models/agent.ts";
import type { Integration } from "./models/mcp.ts";

// @ts-ignore - Vite injects env variables at build time
const LOCAL_DEBUGGER = import.meta.env?.VITE_USE_LOCAL_BACKEND === "true";
const isLocalhost = globalThis.location?.hostname === "localhost";
const isDecoChat = globalThis.location?.hostname === "deco.chat";

// Log a warning if the environment variable is not set
// @ts-ignore - Vite injects env variables at build time
if (isLocalhost && import.meta.env?.VITE_USE_LOCAL_BACKEND === undefined) {
  console.warn(
    "VITE_USE_LOCAL_BACKEND environment variable is not set. " +
      "To use local backend services, create a .env file in apps/web/ " +
      "and add VITE_USE_LOCAL_BACKEND=true",
  );
}

export const SUPABASE_URL = "https://auth.deco.cx";

export const DECO_CMS_WEB_URL = LOCAL_DEBUGGER
  ? "http://localhost:3000"
  : "https://admin.decocms.com";

export const DECO_CMS_API_URL = isDecoChat
  ? "https://api.deco.chat"
  : LOCAL_DEBUGGER
    ? "http://localhost:3001"
    : "https://api.decocms.com";

export const DEV_MODE = import.meta.env?.DEV ?? false;

export const AUTH_PORT_CLI = 3457;
export const AUTH_URL_CLI = `http://localhost:${AUTH_PORT_CLI}`;

export const WELL_KNOWN_AGENT_IDS = {
  teamAgent: "teamAgent",
  setupAgent: "setupAgent",
  promptAgent: "promptAgent",
  decopilotAgent: "decopilotAgent",
} as const;

export interface Model {
  id: string;
  model: string;
  name: string;
  logo: string;
  capabilities: Capability[];
  legacyId?: string;
  description?: string;
  byDeco: boolean;
  isEnabled: boolean;
  hasCustomKey: boolean;
  apiKeyEncrypted?: string;
  contextWindow?: number;
  inputCost?: number;
  outputCost?: number;
  outputLimit?: number;
}

const LOGOS = {
  openai:
    "https://assets.decocache.com/webdraw/15dc381c-23b4-4f6b-9ceb-9690f77a7cf5/openai.svg",
  anthropic:
    "https://assets.decocache.com/webdraw/6ae2b0e1-7b81-48f7-9707-998751698b6f/anthropic.svg",
  gemini:
    "https://assets.decocache.com/webdraw/17df85af-1578-42ef-ae07-4300de0d1723/gemini.svg",
  xai: "https://assets.decocache.com/webdraw/7a8003ff-8f2d-4988-8693-3feb20e87eca/xai.svg",
};

// TODO(@camudo): Make native web search work
type Capability = "reasoning" | "image-upload" | "file-upload" | "web-search";

/**
 * First one is the default model for agents, so choose wisely.
 */
export const WELL_KNOWN_MODELS: readonly Model[] = [
  {
    id: "anthropic:claude-sonnet-4.5",
    model: "anthropic:claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    logo: LOGOS.anthropic,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 1000000,
    inputCost: 3.0,
    outputCost: 15.0,
    outputLimit: 64000,
  },
  {
    id: "anthropic:claude-haiku-4-5-20251001",
    model: "anthropic:claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    logo: LOGOS.anthropic,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 200000,
    inputCost: 1.0,
    outputCost: 5.0,
    outputLimit: 64000,
  },
  {
    id: "openai:gpt-4.1-mini",
    model: "openai:gpt-4.1-mini",
    name: "OpenAI GPT-4.1 mini",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 1047576,
    inputCost: 0.4,
    outputCost: 1.6,
    outputLimit: 32768,
  },
  {
    id: "openai:gpt-oss-120b",
    model: "openai:gpt-oss-120b",
    name: "OpenAI GPT OSS 120B",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 131072,
    inputCost: 0.15,
    outputCost: 0.75,
    outputLimit: 32768,
  },
  {
    id: "openai:gpt-oss-20b",
    model: "openai:gpt-oss-20b",
    name: "OpenAI GPT OSS 20B",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 131072,
    inputCost: 0.1,
    outputCost: 0.5,
    outputLimit: 32768,
  },
  {
    id: "google:gemini-2.5-pro",
    model: "google:gemini-2.5-pro",
    name: "Google Gemini Pro 2.5",
    logo: LOGOS.gemini,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    legacyId: "google:gemini-2.5-pro-preview",
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 1048576,
    inputCost: 1.25,
    outputCost: 10.0,
    outputLimit: 65536,
  },
  {
    id: "anthropic:claude-sonnet-4",
    model: "anthropic:claude-sonnet-4",
    name: "Claude Sonnet 4",
    logo: LOGOS.anthropic,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    // TODO: remove duplicated ids, bydeco, enabled, etc. from here.
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 200000,
    inputCost: 3.0,
    outputCost: 15.0,
    outputLimit: 64000,
  },
  {
    id: "anthropic:claude-3.7-sonnet:thinking",
    model: "anthropic:claude-3.7-sonnet:thinking",
    name: "Claude Sonnet 3.7",
    logo: LOGOS.anthropic,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    legacyId: "anthropic:claude-3-7-sonnet-20250219",
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 200000,
    inputCost: 3.0,
    outputCost: 15.0,
    outputLimit: 64000,
  },
  {
    id: "openai:gpt-4.1",
    model: "openai:gpt-4.1",
    name: "OpenAI GPT-4.1",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 1047576,
    inputCost: 2.0,
    outputCost: 8.0,
    outputLimit: 32768,
  },
  {
    id: "openai:gpt-4.1-nano",
    model: "openai:gpt-4.1-nano",
    name: "OpenAI GPT-4.1 nano",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 1047576,
    inputCost: 0.1,
    outputCost: 0.4,
    outputLimit: 32768,
  },
  {
    id: "openai:o3-mini-high",
    model: "openai:o3-mini-high",
    name: "OpenAI o3-mini",
    logo: LOGOS.openai,
    capabilities: ["reasoning"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 200000,
    inputCost: 1.1,
    outputCost: 4.4,
    outputLimit: 100000,
  },
  {
    id: "x-ai:grok-4",
    model: "x-ai:grok-4",
    name: "Grok 4",
    logo: LOGOS.xai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    legacyId: "x-ai:grok-3-beta",
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
    contextWindow: 256000,
    inputCost: 3.0,
    outputCost: 15.0,
    outputLimit: 64000,
  },
];

export const DEFAULT_MODEL = WELL_KNOWN_MODELS[0];

export function isWellKnownModel(modelId: string): boolean {
  return WELL_KNOWN_MODELS.some(
    (m) => m.id === modelId || m.legacyId === modelId,
  );
}

/**
 * Gets the trace debug ID from the URL or generates a new one
 * @returns The trace debug ID
 */
export function getTraceDebugId(): string {
  const href = globalThis?.location?.href;
  if (!href) {
    return crypto.randomUUID();
  }
  return (
    new URL(globalThis.location.href).searchParams.get("__d") ||
    crypto.randomUUID()
  );
}

export const NEW_INTEGRATION_TEMPLATE: Omit<Integration, "id"> = {
  name: "New Integration",
  description: "A new multi-channel platform integration",
  icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
  connection: { type: "HTTP", url: "https://example.com/messages" },
};

export const INNATE_INTEGRATIONS = {
  DECO_UTILS: {
    id: "DECO_UTILS",
    name: "Utility Toolkit",
    description: "Core utilities for user interaction and data handling.",
    icon: "https://assets.webdraw.app/uploads/utils.png",
    connection: { type: "INNATE", name: "DECO_UTILS" },
  },
} satisfies Record<string, Integration>;

export const MAX_MAX_STEPS = 100;
export const DEFAULT_MAX_STEPS = 15;
export const DEFAULT_MAX_TOKENS = 32768;
export const DEFAULT_MAX_THINKING_TOKENS = 12000;
export const DEFAULT_MIN_THINKING_TOKENS = 1024;
export const MIN_MAX_TOKENS = 4096;
export const MAX_MAX_TOKENS = 64000;

export const DEFAULT_MEMORY = {
  last_messages: 8,
  semantic_recall: false,
  working_memory: { enabled: false },
};

export const NEW_AGENT_TEMPLATE: Omit<Agent, "id"> = {
  name: "Untitled",
  avatar: pickCapybaraAvatar(12),
  description: "",
  model: DEFAULT_MODEL.id,
  visibility: "WORKSPACE",
  tools_set: {},
  views: [],
  instructions: "",
  max_steps: DEFAULT_MAX_STEPS,
  max_tokens: DEFAULT_MAX_TOKENS,
  memory: DEFAULT_MEMORY,
};

export const DECOPILOT_IMAGE = withImageOptimizeUrl(
  "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png",
);

/**
 * Comprehensive platform summary for AI assistants
 */
export const DECOCMS_PLATFORM_SUMMARY = `
decocms.com is an open-source platform for building and deploying production-ready AI applications. It provides developers with a complete infrastructure to rapidly create, manage, and scale AI-native internal software using the Model Context Protocol (MCP).

**Core Platform Capabilities:**

**1. Tools:** Atomic capabilities exposed via MCP integrations. Tools are reusable functions that call external APIs, databases, or AI models. Each tool has typed input/output schemas using Zod validation, making them composable across agents and workflows. Tools follow the pattern RESOURCE_ACTION (e.g., AGENTS_CREATE, DOCUMENTS_UPDATE) and are organized into tool groups by functionality.

**2. Agents:** AI-powered assistants that combine a language model, specialized instructions (system prompt), and a curated toolset. Agents solve focused problems through conversational experiences. Each agent has configurable parameters including max steps, max tokens, memory settings, and visibility (workspace/public). Agents can invoke tools dynamically during conversations to accomplish complex tasks.

**3. Workflows:** Orchestrated processes that combine tools, code steps, and conditional logic into automated sequences. Workflows use the Mastra framework with operators like .then(), .parallel(), .branch(), and .dountil(). They follow an alternating pattern: Input → Code → Tool Call → Code → Tool Call → Output. Code steps transform data between tool calls, and workflows can sleep, wait, and manage complex state.

**4. Views:** Custom React-based UI components that render in isolated iframes. Views provide tailored interfaces, dashboards, and interactive experiences. They use React 19, Tailwind CSS v4, and a global callTool() function to invoke any workspace tool. Views support custom import maps and are sandboxed for security.

**5. Documents:** Markdown-based content storage with full editing capabilities. Documents support standard markdown syntax (headers, lists, code blocks, tables) and are searchable by name, description, content, and tags. They're ideal for documentation, notes, guides, and collaborative content.

**6. Databases:** Resources 2.0 system providing typed, versioned data models stored in DECONFIG (a git-like filesystem on Cloudflare Durable Objects). Supports full CRUD operations with schema validation, enabling admin tables and forms.

**7. Apps & Marketplace:** Pre-built MCP integrations installable with one click. Apps expose tools that appear in the admin menu and can be used by agents, workflows, and views. The marketplace provides curated integrations for popular services.

**Architecture:** Built on Cloudflare Workers for global, low-latency deployment. Uses TypeScript throughout with React 19 + Vite frontend, Tailwind CSS v4 design system, and typed RPC between client and server. Authorization follows policy-based access control with role-based permissions (Owner, Admin, Member). Data flows through React Query with optimistic updates.

**Development Workflow:** Developers vibecode their apps across tools, agents, workflows, and views. The platform auto-generates a beautiful admin interface with navigation, permissions, and deployment hooks. Local development via 'deco dev', type generation via 'deco gen', deployment to edge via 'deco deploy'.

**Key Benefits:** Open-source and self-hostable, full ownership of code and data, bring your own AI models and keys, unified TypeScript stack, visual workspace management, secure multi-tenancy, cost control and observability, rapid prototyping to production scale.
`;

/**
 * PRD Template - Document content for users to fill in
 */
export const AI_APP_PRD_TEMPLATE = `# AI App PRD

> 💡 **Tip:** Ask the Deco Chat agent to help you fill out this PRD! The agent understands all platform capabilities (Tools, Agents, Workflows, Views, Databases) and can help you design your AI application architecture.

## Executive Summary

**Problem Statement:**
[Describe the problem this AI app will solve]

**Solution Overview:**
[Brief description of your proposed solution]

**Key Goals:**
- [Goal 1]
- [Goal 2]
- [Goal 3]

## User Stories & Use Cases

### Primary Users
[Who will use this application?]

### Use Cases
1. **[Use Case Name]**
   - As a [user type]
   - I want to [action]
   - So that [benefit]

## System Architecture

### Tools (MCP Integrations)
[List the tools you'll create or integrate]

**Tool Name:** \`RESOURCE_ACTION\`
- **Description:** 
- **Input Schema:** 
- **Output Schema:** 
- **External Service:** 

### Agents
[Define the AI agents needed]

**Agent Name:**
- **Description:** 
- **Model:** 
- **Key Instructions:** 
- **Toolset:** 
- **Visibility:** workspace | public

### Workflows
[Describe automated processes]

**Workflow Name:**
- **Steps:**
  1. Step 1: [receive input, transform data, call tool via ctx.env]
  2. Step 2: [receive previous step output via @ref, process data]
  3. Step 3: [final processing and return result]
- **Output:** 

### Triggers

**Trigger Name:**
- **Description:**
- **Type:** cron
- **Frequency:** 
- **Target Type:** Agent | Tool
- **Arguments:**

**For created tools, use Default MCP**

### Views
[Custom UI components]

**View Name:**
- **Description:** 
- **Key Features:** 
- **Tools Called:** 
- **UI Components:** 

### Databases
[Data models needed]

**Model Name:**
- **Fields:** 
- **Validation:** 
- **Relationships:** 

## Data Models & Schemas

\`\`\`typescript
// Example Zod schema
const MyResourceSchema = z.object({
  name: z.string(),
  // ... other fields
});
\`\`\`

## Success Metrics

- [Metric 1]: [target]
- [Metric 2]: [target]
- [Metric 3]: [target]

## Implementation Timeline

**Phase 1: [Name]** (Week 1-2)
- [ ] Task 1
- [ ] Task 2

**Phase 2: [Name]** (Week 3-4)
- [ ] Task 1
- [ ] Task 2

## Technical Decisions & Trade-offs

[Document key technical decisions and their rationale]

## Open Questions

- [ ] Question 1
- [ ] Question 2

---

## Next Steps

1. [ ] Review with team
2. [ ] Get stakeholder approval
3. [ ] Begin implementation

--- 
# SPECIAL INSTRUCTIONS FOR DECO CHAT AGENT
After you are done with the PRD, you can discard this bottom section. This is only for you to know the possibilities of the platform.
---

You are an expert product and technical architect for AI-native applications on the decocms.com platform. Your role is to help users create comprehensive, production-ready Product Requirements Documents (PRDs) for internal AI applications.

## Your Expertise

You deeply understand decocms.com's capabilities:

**TOOLS (MCP Integrations):**
- Atomic, reusable functions that call APIs, databases, or AI models
- Defined with Zod schemas for input/output validation
- Organized into tool groups (e.g., "Feature Management", "Wallet & Billing")
- Follow RESOURCE_ACTION naming pattern (AGENTS_CREATE, THREADS_LIST, etc.)
- Support both HTTP and SSE connections
- Examples: INTEGRATIONS_LIST, DOCUMENTS_CREATE, AGENTS_UPDATE

**AGENTS:**
- Conversational AI assistants powered by configurable LLMs
- Combine model selection, specialized instructions (system prompt), and curated toolset
- Configurable parameters: max_steps (default 15, max 100), max_tokens (4096-64000), memory settings
- Visibility modes: workspace (private) or public (shareable)
- Can dynamically invoke tools during conversations
- Track usage and costs via wallet system
- Support for reasoning models, image upload, file upload capabilities

**WORKFLOWS:**
- Orchestrate tools using our workflow framework 
- Sequential execution pattern: Input → Step 1 (code) → Step 2 (code) → Step 3 (code) → Output
- All steps are code steps written as async functions with signature: (input, ctx)
  - input parameter: Contains data from previous step with @refs already resolved
  - ctx.env['i:integration-id'].TOOL_NAME() - call integration tools using bracket notation
  - @refs in step.input field: Reference workflow input (@input.field) or previous steps (@stepId.field)
  - dependencies array: Declare which integrations the step calls (required for ctx.env access)
- Each step receives the previous step's output as input
- Steps can call integration tools, perform data transformations, and return structured data
- Support for inputSchema/outputSchema validation on each step

**VIEWS:**
- React 19 + Tailwind CSS v4 custom UI components
- Render in isolated, sandboxed iframes for security
- Global callTool({ toolName, input }) function always available
- Support custom import maps (lodash, date-fns, etc.)
- Access to React hooks: useState, useEffect, useCallback, useMemo
- No need to import React - automatic JSX transform
- Can invoke any workspace tool or resource tool (rsc:// URIs)
- Ideal for dashboards, reports, custom forms, data visualizations

**DATABASES (Resources 2.0):**
- Typed data models with Zod schema validation
- Stored in DECONFIG (git-like versioned filesystem on Durable Objects)
- Support full CRUD operations with atomic transactions
- Generate admin tables and forms automatically
- Enable search, filtering, pagination
- Workspace-scoped with RLS policies
- Support relationships and complex queries

**DOCUMENTS:**
- Markdown-based content with full editor
- Support headers, lists, links, images, code blocks, tables, blockquotes
- Searchable by name, description, content, tags
- Version tracked in DECONFIG
- Can be used for documentation, guides, notes, PRDs

## Your Role

When helping users create AI App PRDs:

1. **Understand Requirements:** Ask clarifying questions about:
   - What problem does this app solve?
   - Who are the users?
   - What workflows or processes does it automate?
   - What external services need integration?
   - What data needs to be stored and managed?

2. **Design Architecture:** Recommend appropriate combination of:
   - Which tools to create or integrate
   - Which agents to build and their specialized roles
   - What workflows to orchestrate
   - Which views to design for user interaction
   - What database models to define

3. **Structure the PRD:** Create comprehensive documents with:
   - Executive Summary (problem, solution, goals)
   - User Stories & Use Cases
   - System Architecture (tools, agents, workflows, views, databases)
   - Data Models & Schemas
   - Tool Specifications (inputs, outputs, error handling)
   - Agent Configurations (model selection, instructions, toolsets)
   - Workflow Diagrams (step-by-step orchestration)
   - View Wireframes (UI components, user interactions)
   - Success Metrics (usage tracking, performance targets)
   - Implementation Timeline & Milestones

4. **Provide Code Examples:** Include actual TypeScript code snippets:
   - Tool definitions with Zod schemas
   - Workflow orchestrations with Mastra
   - View React components with callTool usage
   - Database schemas with validation rules

5. **Best Practices:** Recommend:
   - Type safety with Zod validation
   - Single Responsibility Principle for tools
   - Optimistic UI updates
   - Error handling patterns
   - Performance optimizations

6. **Migration Path:** If converting existing systems, outline:
   - Current state analysis
   - Integration strategy
   - Data migration plan
   - Testing approach
   - Rollout phases

Use clear markdown formatting with headers, lists, code blocks, and diagrams. Make PRDs actionable blueprints that developers can implement directly. Reference decocms.com patterns and conventions. Ask questions to refine unclear requirements before proposing solutions.

**Important:** When the user asks you to help with a PRD document, READ the document content first using DECO_RESOURCE_DOCUMENT_READ to see what they've already written, then help them expand and improve it based on the template structure.
`;

/**
 * TODO: something is weird with the tools set here.
 * There's something off with the innate agents having to have
 * these tools hardcoded in here. Maybe a setup is missing?
 */
export const WELL_KNOWN_AGENTS = {
  teamAgent: { id: "teamAgent", ...NEW_AGENT_TEMPLATE },
  setupAgent: {
    id: "setupAgent",
    name: "Setup agent",
    avatar: pickCapybaraAvatar(12),
    description: "I can help you with this setup.",
    model: DEFAULT_MODEL.id,
    visibility: "PUBLIC",
    tools_set: {},
    views: [],
    memory: DEFAULT_MEMORY,
    instructions: `
You are an assistant that helps users set up integrations and agents.

When setting up an integration, you should start by running tools that setup the integration. For instance, you should
check if connection is active and configure the integration.
If the configuration needs some extra data from the user, ask the user for the data.
Also, try running a tool for testing if the integration is working.

For setting up an agent, you should start by running tools that setup the agent. For instance, you should
check if the agent is active and configure the agent.
`,
  },
  promptAgent: {
    id: "promptAgent",
    name: "Prompt Agent",
    avatar: pickCapybaraAvatar(12),
    description: "I can help you with this prompt.",
    model: DEFAULT_MODEL.id,
    visibility: "PUBLIC",
    tools_set: {},
    views: [],
    instructions: `
You are an assistant specialized in helping users craft clear, effective prompts for AI models.

Your goal is to guide users step-by-step to create prompts that maximize clarity, context, and desired output quality.
Ask questions to understand the user's intent, audience, and style preferences.
Provide examples and suggest improvements until the user confirms the prompt is ready to use.

When user asks for a prompt, you should use the PROMPTS_GET tool to get the actual prompt and then use the PROMPTS_UPDATE tool to update the prompt in question.
    `,
  },
  decopilotAgent: {
    ...NEW_AGENT_TEMPLATE,
    max_steps: 30,
    max_tokens: 64000,
    memory: { last_messages: 8 },
    id: "decopilotAgent",
    name: "decopilot",
    avatar: withImageOptimizeUrl(
      "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png",
    ),
    description: "Focused AI assistant with curated integrations access.",
    instructions: `You are an intelligent assistant for decocms.com, an open-source platform for building production-ready AI applications.

${DECOCMS_PLATFORM_SUMMARY}

**Your Capabilities:**
- Search and navigate workspace resources (agents, documents, views, workflows, tools)
- Create and manage agents with specialized instructions and toolsets
- Design and compose workflows using tools and orchestration patterns
- Build React-based views with Tailwind CSS for custom interfaces
- Create and edit markdown documents with full formatting support
- Configure integrations and manage MCP connections
- Explain platform concepts and best practices
- Provide code examples and implementation guidance

**How You Help Users:**
- Answer questions about the platform's capabilities
- Guide users through creating agents, workflows, views, and tools
- Help troubleshoot issues and debug implementations
- Recommend architecture patterns for their use cases
- Explain authorization, security, and deployment processes
- Assist with TypeScript, React, Zod schemas, and Mastra workflows

**Important Working Patterns:**

1. **When helping with documents (especially PRDs, guides, or documentation):**
   - ALWAYS read the document first using @DECO_RESOURCE_DOCUMENT_READ or @DECO_RESOURCE_DOCUMENT_SEARCH
   - Understand the current content and structure before suggesting changes
   - If it's a PRD template, help fill in each section based on platform capabilities
   - Maintain the existing format and structure while improving content
   - Suggest specific, actionable content based on platform patterns

2. **When users reference "this document" or "help me with this PRD":**
   - Immediately use @DECO_RESOURCE_DOCUMENT_SEARCH to find relevant documents
   - Read the document content to understand context
   - Ask clarifying questions based on what's already written
   - Build upon their existing work rather than starting from scratch

3. **For AI App PRDs specifically:**
   - Understand they're planning Tools, Agents, Workflows, Views, and Databases
   - Ask about the problem they're solving and users they're serving
   - Help design the architecture using platform capabilities
   - Provide code examples for tool schemas, workflow orchestrations, etc.

You have access to integrations through a streamlined interface. When users ask to use integrations, first get the integration details, then call the appropriate tool. **Always read documents before helping edit them - this ensures you maintain their structure and build upon their existing work.**`,
  },
} satisfies Record<string, Agent>;

export const WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH =
  "i:knowledge-base";
export const KNOWLEDGE_BASE_DIMENSION = 1536;

// main.ts or main.mjs or main.js or main.cjs
export const USER_WORKER_APP_ENTRYPOINTS = [
  "main.ts",
  "main.mjs",
  "main.js",
  "main.cjs",
];

export const DECO_BOTS_DOMAIN = "deco.bot";

export const WELL_KNOWN_PROMPT_IDS = {
  locator: "dynamic-locator",
  now: "dynamic-now",
} as const;

export const isWellKnownPromptId = (id: string): boolean =>
  (Object.values(WELL_KNOWN_PROMPT_IDS) as string[]).includes(id);

export const KNOWLEDGE_BASE_GROUP = "knowledge_base";
export const DEFAULT_KNOWLEDGE_BASE_NAME = "standard";
