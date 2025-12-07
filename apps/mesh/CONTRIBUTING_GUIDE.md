# Contributing to MCP Mesh

> A comprehensive guide for contributors to understand the architecture, current state, and roadmap of MCP Mesh.

## Table of Contents

- [What is MCP Mesh?](#what-is-mcp-mesh)
- [Architecture Overview](#architecture-overview)
- [Key Concepts](#key-concepts)
- [Development Setup](#development-setup)
- [Codebase Structure](#codebase-structure)
- [Current State (December 2025)](#current-state-december-2025)
- [Roadmap & Areas for Contribution](#roadmap--areas-for-contribution)
- [MCP Apps vs External MCPs](#mcp-apps-vs-external-mcps)
- [Contributing Guidelines](#contributing-guidelines)

---

## What is MCP Mesh?

MCP Mesh is an open-source platform that acts as a **secure proxy** between AI clients (Claude Desktop, Cursor, custom clients) and MCP (Model Context Protocol) services. It centralizes connection management, provides fine-grained access control, encrypted credential storage, and unified observability.

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Claude Desktop │────▶│   MCP Mesh   │────▶│  Gmail MCP      │
│  Cursor Agent   │     │   (Proxy)    │     │  Slack MCP      │
│  Custom Client  │     │              │────▶│  GitHub MCP     │
└─────────────────┘     └──────────────┘     └─────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │ - Authentication   │
                    │ - Authorization    │
                    │ - Credential Vault │
                    │ - Audit Logging    │
                    │ - Observability    │
                    └────────────────────┘
```

### Core Value Propositions

1. **Connection Centralization** — Connect all MCP services in one place
2. **Fine-grained Access Control** — Share access without sharing credentials
3. **Tool Composition** — MCP services can depend on each other
4. **MCP-native API** — The Mesh itself is an MCP service

---

## Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| HTTP Server | Hono |
| Database | Kysely (SQLite default, PostgreSQL/MySQL supported) |
| Auth | Better Auth (+ MCP, API Key, Organization plugins) |
| Frontend | React 19, TanStack Router, TanStack Query |
| Styling | Tailwind CSS v4 |
| MCP Protocol | @modelcontextprotocol/sdk |
| Observability | OpenTelemetry, Prometheus |

### Request Flow

```
HTTP Request → Hono Server → MeshContext Injection → Route Handler
                                     │
                                     ▼
                    ┌──────────────────────────────────────┐
                    │           MeshContext                │
                    ├──────────────────────────────────────┤
                    │ auth: { user, apiKey }               │
                    │ organization: { id, slug, name }     │
                    │ storage: { connections, auditLogs }  │
                    │ vault: CredentialVault               │
                    │ access: AccessControl                │
                    │ tracer: OpenTelemetry Tracer         │
                    │ meter: OpenTelemetry Meter           │
                    └──────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
              /mcp (self)                    /mcp/:connectionId
                    │                                 │
                    ▼                                 ▼
          Management Tools               MCP Proxy (downstream)
          (ORGANIZATION_*,               - Credential injection
           CONNECTION_*, etc.)           - Authorization checks
                                         - Request forwarding
```

### Key Design Decisions

1. **Organization-Based Architecture** — All resources are organization-scoped (no project scoping)
2. **MCP-Native API** — Management operations exposed as MCP tools, not REST
3. **Minimal Configuration** — Only `DATABASE_URL` env var needed; auth via `auth-config.json`
4. **JWT with Audience Claims** — Strong isolation via `aud` claims
5. **Zero-Config SQLite** — Works out of the box, upgrade to PostgreSQL when needed
6. **Credential Isolation** — Original tokens never leave the Mesh

---

## Key Concepts

### Connections

A **Connection** represents a link to an external MCP service. It stores:

- `connection_url` — The MCP endpoint URL
- `connection_token` — Encrypted authentication token
- `connection_headers` — Custom headers for the connection
- `tools` — Discovered tools from the MCP (fetched on creation)
- `configuration_state` — Encrypted configuration for apps that require setup
- `bindings` — Detected capability bindings (LLMS, AGENTS, etc.)

### Bindings

**Bindings** are standardized interfaces that MCP services can implement. They define required tools with specific schemas. A service "implements" a binding if it provides tools matching the binding specification.

Built-in bindings:

| Binding | Description |
|---------|-------------|
| `LLMS` | Language model capabilities (chat, completions) |
| `AGENTS` | AI agent capabilities |
| `MCP` | Basic MCP service |
| `REGISTRY_APP` | App registry/store capabilities |

### Collections

**Collections** are a binding pattern for CRUD operations. A collection exposes tools like:

- `COLLECTION_{NAME}_LIST` — List items with filtering/pagination
- `COLLECTION_{NAME}_GET` — Get a single item by ID
- `COLLECTION_{NAME}_CREATE` — Create a new item
- `COLLECTION_{NAME}_UPDATE` — Update an existing item
- `COLLECTION_{NAME}_DELETE` — Delete an item

Example: The connections themselves are managed via `COLLECTION_CONNECTIONS_*` tools.

### Tool Definition Pattern

Tools are defined using `defineTool()` with Zod schemas:

```typescript
import { z } from "zod";
import { defineTool } from "../../core/define-tool";

export const MY_TOOL = defineTool({
  name: "MY_TOOL",
  description: "Does something useful",
  
  inputSchema: z.object({
    param: z.string(),
  }),
  
  outputSchema: z.object({
    result: z.string(),
  }),
  
  handler: async (input, ctx) => {
    // ctx is MeshContext with auth, storage, etc.
    await ctx.access.check();
    return { result: "done" };
  },
});
```

---

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- Node.js 20+ (for some tooling)

### Quick Start

```bash
# From repo root
cd apps/mesh

# Install dependencies
bun install

# Run database migrations
bun run migrate

# Start development server (hot reload)
bun run dev
```

The server starts at `http://localhost:3000`:

- 📋 Health check: `http://localhost:3000/health`
- 🔐 Auth endpoints: `http://localhost:3000/api/auth/*`
- 🔧 MCP endpoint: `http://localhost:3000/mcp`
- 📊 Metrics: `http://localhost:3000/metrics`

### Useful Scripts

```bash
bun run dev           # Dev server with hot reload
bun run test          # Run tests
bun run check         # TypeScript type check
bun run build:client  # Build React frontend
bun run build:server  # Build server bundle
bun run migrate       # Run database migrations
```

---

## Codebase Structure

```
apps/mesh/
├── src/
│   ├── index.ts                    # Entry point (Bun.serve)
│   │
│   ├── api/                        # Hono HTTP server
│   │   ├── index.ts                # Main Hono app, middleware, routes
│   │   ├── http-server-transport.ts # MCP-over-HTTP transport
│   │   ├── llm-provider.ts         # LLM provider routing
│   │   └── routes/
│   │       ├── auth.ts             # Custom auth routes
│   │       ├── management.ts       # /mcp management MCP server
│   │       ├── models.ts           # /api/models LLM routing
│   │       └── proxy.ts            # /mcp/:connectionId proxy
│   │
│   ├── auth/                       # Better Auth configuration
│   │   ├── index.ts                # Auth instance with plugins
│   │   ├── jwt.ts                  # JWT utilities (mesh tokens)
│   │   ├── oauth-providers.ts      # Google, GitHub OAuth
│   │   ├── magic-link.ts           # Passwordless auth
│   │   └── sso.ts                  # SAML SSO
│   │
│   ├── core/                       # Core abstractions
│   │   ├── access-control.ts       # Permission checking
│   │   ├── config.ts               # Configuration loading
│   │   ├── context-factory.ts      # MeshContext factory
│   │   ├── define-tool.ts          # Tool definition helper
│   │   └── mesh-context.ts         # Request context interface
│   │
│   ├── database/                   # Database setup
│   │   ├── index.ts                # Kysely instance (SQLite/PostgreSQL)
│   │   └── migrate.ts              # Migration runner
│   │
│   ├── encryption/                 # Security
│   │   └── credential-vault.ts     # AES-256-GCM encryption
│   │
│   ├── observability/              # Monitoring
│   │   └── index.ts                # OpenTelemetry setup
│   │
│   ├── storage/                    # Database adapters
│   │   ├── ports.ts                # Storage interface definitions
│   │   ├── types.ts                # Kysely table types
│   │   ├── connection.ts           # Connection CRUD
│   │   ├── organization-settings.ts # Org settings
│   │   └── audit-log.ts            # Audit logging
│   │
│   ├── tools/                      # MCP management tools
│   │   ├── index.ts                # Tool registry (ALL_TOOLS)
│   │   ├── registry.ts             # Tool metadata
│   │   ├── client.ts               # Tool calling client
│   │   ├── connection/             # COLLECTION_CONNECTIONS_* tools
│   │   │   ├── schema.ts           # Zod schemas
│   │   │   ├── create.ts           # Create connection
│   │   │   ├── list.ts             # List connections
│   │   │   ├── get.ts              # Get connection
│   │   │   ├── update.ts           # Update connection
│   │   │   ├── delete.ts           # Delete connection
│   │   │   ├── test.ts             # Test connection health
│   │   │   ├── configure.ts        # Configure connection
│   │   │   └── fetch-tools.ts      # Fetch tools from MCP
│   │   ├── organization/           # ORGANIZATION_* tools
│   │   └── database/               # DATABASE_* tools
│   │
│   └── web/                        # React frontend
│       ├── index.tsx               # React entry
│       ├── components/
│       │   ├── collections/        # Generic collection UI
│       │   ├── details/            # Detail views (connection, tool)
│       │   ├── store/              # Store/marketplace UI
│       │   │   ├── store-discovery.tsx
│       │   │   ├── store-discovery-ui.tsx
│       │   │   ├── registry-item-card.tsx
│       │   │   └── registry-items-section.tsx
│       │   └── ...
│       ├── hooks/
│       │   ├── collections/        # Collection data hooks
│       │   ├── use-binding.ts      # Binding detection hooks
│       │   └── ...
│       ├── routes/                 # TanStack Router pages
│       │   └── orgs/
│       │       ├── store.tsx       # Store page
│       │       └── store-app-detail.tsx # App detail & install
│       └── providers/              # React context providers
│
├── migrations/                     # Kysely migrations
├── spec/                           # Design specifications
│   └── 001.md                      # Full technical spec
├── public/                         # Static assets
└── data/                           # SQLite database (gitignored)
```

---

## Current State (December 2025)

### ✅ Implemented Features

- **Organization Management** — Create orgs, invite members, assign roles
- **Connection Registry** — Register and manage MCP connections
- **Secure Credential Vault** — AES-256-GCM encrypted storage
- **MCP Proxy** — Proxy requests with credential injection
- **OAuth 2.1 Server** — Full MCP OAuth spec compliance (PKCE, DCR)
- **Management Tools via MCP** — All admin ops exposed as MCP tools
- **Web Dashboard** — React UI for management
- **Multi-DB Support** — SQLite, PostgreSQL, MySQL via Kysely
- **OpenTelemetry** — Distributed tracing and Prometheus metrics
- **Magic Link Auth** — Passwordless email authentication
- **SSO Support** — Google, GitHub, SAML providers
- **Store/Marketplace** — Browse and install MCP apps from registries

### Recent Development (Last 2 Weeks)

Based on commit history, the team has been focused on:

1. **Store/Marketplace** (`fd149444`, `ed6966f9`)
   - Registry-based app discovery
   - Install apps directly from store
   - Auto-install Deco Store on org creation

2. **MCP Apps PDP (Product Detail Page)** (`f239b385`)
   - Enhanced app detail views
   - Publisher info extraction
   - Verified badge support

3. **Chat Integration** (`da4d0470`, `4f62ca99`)
   - Restructured chat components
   - Improved modularity

4. **Collections with JSON Schema** (`a55ebf52`)
   - Schema support for collections
   - Better form generation

5. **Add to Cursor Button** (`08cd2699`)
   - One-click MCP installation to Cursor

6. **Runtime Integration** (`f80deb25`, `5ef0c350`)
   - MCP Mesh runtime package
   - Configuration binding

### 🚧 Planned Features

- [ ] **MCP Bindings** — Protocol-level interfaces for tool abstraction
- [ ] **Tool Composition** — Tools calling other tools across connections
- [ ] **Webhook Events** — Event-driven integrations
- [ ] **CLI Tool** — Command-line management

---

## Roadmap & Areas for Contribution

### High-Priority Areas

#### 1. MCP Apps (Virtual MCPs) — **You asked about this!**

The concept of "MCP Apps" is actively being developed. These are **virtual MCPs** that you can **INSTALL** from the store, as opposed to **CONNECT** to an external MCP.

**Current State:**
- Store UI exists (`src/web/components/store/`)
- Registry binding defined (`REGISTRY_APP_BINDING`)
- Install flow works via `extractConnectionData()` in `store-app-detail.tsx`
- Apps from registry get installed as connections

**Where it's going:**
- Apps should be "installable" without requiring external hosting
- The Mesh itself could host lightweight MCP logic
- Configuration schemas rendered as forms (partially implemented)
- App dependencies (one app using another's tools)

**Contribution opportunities:**
- Improve app configuration UX
- Build the "app hosting" capability (run MCP logic inside Mesh)
- App versioning and updates
- App permissions/sandbox

#### 2. Tool Composition

Allow tools from different connections to call each other. Example: A "Email + Calendar" workflow where sending an email also creates a calendar event.

**Files to explore:**
- `src/api/routes/proxy.ts` — Current proxy implementation
- `src/tools/connection/configure.ts` — Configuration with scopes

#### 3. Bindings Enhancement

The bindings system needs refinement:

- Schema validation in `packages/bindings/src/core/binder.ts` has a FIXME
- Output schema validation is currently skipped
- Better error messages for binding mismatches

#### 4. CLI Tool

No CLI exists yet. Would need:
- Auth (API key management)
- Connection management
- Organization management
- Deploy/sync configurations

#### 5. Testing

Many components lack tests. Good areas to add tests:
- `src/tools/` — Tool handlers
- `src/storage/` — Storage adapters
- `src/api/routes/proxy.ts` — Proxy behavior

### Medium-Priority Areas

- **Audit Log UI** — Currently stored but no visualization
- **Metrics Dashboard** — Prometheus data exists, needs UI
- **Connection Health Monitoring** — Scheduled health checks
- **Rate Limiting** — Per-connection/per-user limits
- **Webhook Events** — Trigger webhooks on tool calls

---

## MCP Apps vs External MCPs

| Aspect | External MCP (Connect) | MCP App (Install) |
|--------|------------------------|-------------------|
| **Hosting** | Self-hosted or third-party | Could be hosted by Mesh |
| **Discovery** | Manual URL entry | Store/registry browsing |
| **Configuration** | Manual token/headers | Guided form from schema |
| **Updates** | Manual | Potentially automatic |
| **Trust** | User responsibility | Verified by registry |

### How App Installation Works (Current Implementation)

1. User browses store (`store.tsx`)
2. Store fetches items from registry connection (`store-discovery.tsx`)
3. User clicks app → detail page (`store-app-detail.tsx`)
4. Install button extracts connection data from registry item:
   ```typescript
   function extractConnectionData(item: RegistryItem, orgId: string, userId: string) {
     // Extracts: title, description, icon, connection_url, oauth_config, etc.
     // from the registry server's remotes and metadata
   }
   ```
5. Creates a connection in the database
6. User can now use the app via `/mcp/:connectionId`

### Future Vision for MCP Apps

The goal is to support "virtual" MCPs that don't require external hosting:

1. **App Definition** — JSON/YAML definition of tools, their logic, and dependencies
2. **Mesh-Hosted Execution** — Run app logic inside the Mesh (sandboxed)
3. **Configuration Forms** — Auto-generated from JSON Schema
4. **Dependencies** — Apps declare which other connections/tools they need
5. **One-Click Install** — No URL entry, no token setup

---

## Contributing Guidelines

### Code Style

- **TypeScript** strict mode
- **Biome** for formatting (2-space indent, double quotes)
- **Kebab-case** filenames (enforced by lint plugin)
- **Zod** for schemas, derive types from schemas
- **Tailwind** for styling (use design tokens)

### Commit Messages

Follow Conventional Commits:
```
type(scope): message

Examples:
feat(store): add app installation flow
fix(proxy): handle connection timeout
chore(deps): update @modelcontextprotocol/sdk
```

### Testing

```bash
bun test                    # Run all tests
bun test src/core/          # Run specific directory
bun test --watch           # Watch mode
```

### PR Checklist

- [ ] Code follows existing patterns
- [ ] TypeScript types are complete (`bun run check` passes)
- [ ] Tests added for new functionality
- [ ] Formatting clean (`npm run fmt` from repo root)
- [ ] PR description explains the change

### Getting Help

- Read `spec/001.md` for detailed technical spec
- Check `README.md` for quick reference
- Look at existing tools in `src/tools/` for patterns
- Check recent commits for context

---

## Quick Reference

### MCP Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /mcp` | Management tools (ORGANIZATION_*, CONNECTION_*) |
| `POST /mcp/:connectionId` | Proxy to external MCP |
| `GET /.well-known/oauth-authorization-server` | OAuth discovery |
| `GET /metrics` | Prometheus metrics |

### Key Files to Understand

| File | Purpose |
|------|---------|
| `src/api/index.ts` | Main Hono app |
| `src/core/mesh-context.ts` | Context interface |
| `src/core/define-tool.ts` | Tool definition pattern |
| `src/tools/index.ts` | All management tools |
| `src/api/routes/proxy.ts` | MCP proxy logic |
| `src/storage/connection.ts` | Connection CRUD |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `DATABASE_URL` | SQLite | Database connection |
| `ENCRYPTION_KEY` | Auto-generated | Credential encryption |
| `NODE_ENV` | development | Environment |

---

<p align="center">
  Built with 💚 by <a href="https://decocms.com">decocms.com</a>
</p>

