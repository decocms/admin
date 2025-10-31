<img alt="deco CMS" src="https://github.com/user-attachments/assets/d3e36c98-4609-46d3-b39f-7ee1c6d77432" />

<h1 align="center">DecoCMS Admin & MCP Mesh</h1>

<p align="center">
<b>The open-source framework for scalable AI apps.</b><br />
Build, deploy, and govern AI-native systems with full-stack TypeScript.<br />
<code>MCP-native · Edge-deployed · Production-ready</code>
</p>

<p align="center">
<a href="https://docs.deco.page">📘 Docs</a> ·
<a href="https://decocms.com/discord">💬 Discord</a> ·
<a href="https://decocms.com">🌐 decocms.com</a>
</p>

---

## Overview

**DecoCMS** is an open-source foundation for building **AI-native software** — from agent logic to UI to governance.  
It unifies **Model Context Protocol (MCP)**, workflows, and frontends into one **TypeScript runtime** that runs anywhere: Cloudflare, AWS, or self-hosted.

This repository contains **Deco Admin**, the core **MCP Mesh engine** and control plane.  
It’s where developers, teams, and organizations **declare, compose, and govern context** across all AI agents, workflows, and tools.

> Think **Lovable + n8n + LangGraph**, but in one codebase.  
> All in TypeScript. All deployable anywhere.

---

## 🚀 Core Concepts

| Concept | Description |
|----------|--------------|
| **MCP Mesh** | A unified admin and runtime for composing, securing, and observing MCP servers. |
| **Context Management** | A control plane that governs all agent contexts — policies, cost limits, audit logs, and credentials. |
| **Unified Stack** | Backend tools, workflows, and React/Tailwind UIs share one codebase with typed RPC. |
| **Governance-by-Design** | Built-in RBAC, API-key permissions, rate limits, and audit logging using Better Auth. |
| **Observability** | OpenTelemetry traces, metrics, and cost analytics for every workflow and UI interaction. |
| **Deploy Anywhere** | Runs on Cloudflare Workers, AWS, or locally with Bun/Deno — no lock-in, one command deploy. |

---

## 🧩 Architecture

```

apps/mesh/
├── api/               # Hono HTTP layer and MCP proxy endpoints
│   ├── middlewares/   # Auth, context, project scope, observability
│   └── routes/        # /mcp, /mcp/:connectionId
├── core/              # MeshContext, access control, defineTool
├── tools/             # MCP-native management tools (PROJECT_*, CONNECTION_*, etc.)
├── storage/           # Kysely database adapters (SQLite/Postgres)
├── auth/              # Better Auth (OAuth + API keys)
├── observability/     # OpenTelemetry tracing + metrics
└── encryption/        # Credential vault and secure token handling

````

### Key Layers

- **MeshContext** → The unified runtime interface passed to every tool.  
  Gives access to auth, storage, vault, observability, and policy control.
- **defineTool()** → Declarative, Zod-typed function for building MCP tools.  
  Automatically validates, logs, traces, and audits each call.
- **AccessControl** → Fine-grained authorization model (Better Auth + API keys).  
  Supports `"mcp"` (management tools) and `"conn_<UUID>"` (connection-scoped tools).
- **Proxy Layer** → Bridges local agents to remote MCP services with full OAuth 2.1 support.
- **Observability** → Built-in OpenTelemetry integration for metrics, tracing, and cost analytics.

---

## 🕸️ The MCP Mesh

The **MCP Mesh** is the secure hub for all your MCP connections.

### Features

- 🔐 **Centralized Connection Management** — connect all MCP servers with unified OAuth and API-key auth.
- 👥 **Team & Role Permissions** — share connections safely with workspace or project scopes.
- ⚙️ **Tool Composition** — orchestrate tools across services; reuse outputs as inputs.
- 🧠 **MCP-native API** — every management operation is itself an MCP tool (`PROJECT_LIST`, `CONNECTION_CREATE`, etc.).
- 📊 **Observability** — trace every run, view cost and error metrics per tool.
- 💾 **Zero-config Local Deploy** — single `DATABASE_URL`, runs on Bun with embedded SQLite.

---

## 🧠 Example: Define a Tool

```ts
import { z } from "zod";
import { defineTool } from "~/core/define-tool";

export const CONNECTION_CREATE = defineTool({
  name: "CONNECTION_CREATE",
  description: "Create a new MCP connection",
  inputSchema: z.object({
    name: z.string().min(1),
    connection: z.object({
      type: z.enum(["HTTP", "SSE", "Websocket"]),
      url: z.string().url(),
      token: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    id: z.string(),
    scope: z.enum(["workspace", "project"]),
    status: z.enum(["active", "inactive"]),
  }),
  handler: async (input, ctx) => {
    await ctx.access.check(); // Verify permission
    const conn = await ctx.storage.connections.create({
      projectId: ctx.project?.id ?? null,
      ...input,
      createdById: ctx.auth.user!.id,
    });
    return { id: conn.id, scope: conn.projectId ? "project" : "workspace", status: conn.status };
  },
});
````

✅ Type-safe
✅ Audited and observable
✅ Accessible via MCP at `/mcp` or `/mcp/:connectionId`

---

## 🔑 Authentication & Permissions

Built on **Better Auth**, integrating:

* **OAuth 2.1 for MCP clients** (Claude Desktop, Cursor, etc.)
* **API Keys** with rate limits, spend caps, and metadata
* **Admin Plugin** for role-based access control (RBAC)
* **Scoped Permissions** (`"mcp"` for management tools, `"conn_<UUID>"` for downstream connections)

Example permission model:

```json
{
  "mcp": ["PROJECT_CREATE", "PROJECT_LIST", "CONNECTION_CREATE"],
  "conn_123e4567-e89b-12d3-a456-426614174000": ["SEND_MESSAGE", "LIST_THREADS"]
}
```

---

## 📈 Observability

Integrated **OpenTelemetry** instrumentation:

* `tool.execution.duration` — histogram of execution time
* `tool.execution.errors` — counter per tool
* `connection.proxy.requests` — proxy request metrics
* Distributed traces from UI → Agent → Downstream MCP

Export to OTLP collectors, Datadog, or Cloudflare Logs.

---

## 🧰 Development

### Requirements

* [Bun](https://bun.sh) (recommended) or Node/Deno
* [Wrangler](https://developers.cloudflare.com/workers/wrangler/install/) (for deploys)

### Create a new project

```bash
npm create deco
cd my-app
npm run dev
```

Runs locally on [http://localhost:8787](http://localhost:8787)
Deploy to Cloudflare with:

```bash
deco deploy
```

---

## 🏗️ Tech Stack

| Layer               | Technology                                                |
| ------------------- | --------------------------------------------------------- |
| Runtime             | Cloudflare Workers / Bun                                  |
| Language            | TypeScript                                                |
| Auth                | [Better Auth](https://better-auth.com) (OAuth + API Key)  |
| Database            | [Kysely](https://kysely.dev) (SQLite → Postgres)          |
| Web Framework       | [Hono](https://hono.dev)                                  |
| Observability       | [OpenTelemetry](https://opentelemetry.io)                 |
| Frontend (optional) | React + Tailwind + TanStack Router                        |
| Build               | Vite / Bun                                                |
| Protocol            | [Model Context Protocol](https://modelcontextprotocol.io) |

---

## 🧩 Comparison: Metorial vs Deco

|               | **Metorial**                        | **DecoCMS**                                        |
| ------------- | ----------------------------------- | -------------------------------------------------- |
| Focus         | Integration platform for agentic AI | Full-stack AI framework (agents + UI + governance) |
| Language      | Go + TS mix                         | 100 % TypeScript                                   |
| Hosting       | Docker-based                        | Cloudflare / edge-first                            |
| Protocol      | MCP client integration              | MCP-native runtime + admin                         |
| Auth          | Basic API keys                      | Better Auth (OAuth 2.1 + RBAC + API keys)          |
| Observability | Dashboard only                      | Full OpenTelemetry tracing                         |
| UI            | Separate React dashboard            | Shared React/Tailwind workspace                    |
| Goal          | Connect AI to APIs                  | Ship production AI apps with UI, workflow & policy |

---

## 🤝 Contributing

We welcome contributions from the community.
Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup and PR guidelines.

> 🧭 Roadmap highlights
>
> * Multi-tenant admin dashboard
> * Connection marketplace (installable MCP apps)
> * Agent cost governance and spend caps
> * Native view components callable as tools
> * Edge live debugger (real-time traces)

---

<div align="center">
  <sub>Made with ❤️ by the <a href="https://decocms.com">Deco</a> community.<br/>Building the future of AI-native software — open, typed, and governed.</sub>
</div>
```