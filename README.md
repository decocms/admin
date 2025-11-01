<img alt="deco CMS" src="https://github.com/user-attachments/assets/d3e36c98-4609-46d3-b39f-7ee1c6d77432" />

<h1 align="center">DecoCMS: The Context Management System</h1>


<p align="center">
<em>MCP-native · TypeScript-first · Deploy anywhere</em><br/><br/>
<b>Declare and Compose MCPs for your AI Agents and Workflows.</b><br/>
</p>

<p align="center">
<a href="https://docs.deco.page">📘 Docs</a> ·
<a href="https://decocms.com/discord">💬 Discord</a> ·
<a href="https://decocms.com">🌐 decocms.com</a>
</p>

> **TL;DR:**
> - Centralize your company context in a private MCP mesh.<br />
> - Generate full-stack TypeScript AI Apps and publish them as internal MCPs.<br />
> - Have full control over usage, costs, monitoring and sharing. <br/>

## 🚀 What is a Context Management System?

**DecoCMS** is an open‑source Context Management System — the **MCP Mesh** for AI. It centralizes MCP connections, tools, data access, and policies to aggregate organization‑wide context in one secure place. Compose and expose virtual MCPs ("AI Apps") for any client (Claude Desktop, VS Code, custom UIs) with governance, observability, and cost control.

> Think **Lovable + n8n + LangGraph**, running on Cloudflare with a single deploy command.  
> Full-stack AI, production-ready.

---

## 🧭 Architecture at a Glance

- MCP Mesh (kernel): 
  - Compose and secure MCPs across your org; 
  - Connect and proxy external MCPs with secure tokens; 
  - Expose governed Virtual MCPs ("AI Apps") to any MCP client;
  - Enforce auth/RBAC/audit/FinOps; 
  - Get full observability.
- AI App Framework (Virtual MCPs in the Mesh): 
  - Build AI‑native web software (admin, workflows, custom views) that calls Tools; 
  - Fullstack, From database to UI with React 19 + Tailwind v4;
  - Generative Admin interface: _decopilot_ helps you write the PRD and implement.

---

## ✨ Why DecoCMS?

AI teams are stuck between low-code prototypes and enterprise production chaos.  
Backends live in n8n or LangGraph. Frontends in Lovable or React.  
Deployments are separate. Auth is inconsistent. Costs spiral. Debugging is guesswork.

**DecoCMS fixes that:**

- 🧠 **MCP-native** — Compose Model Context Protocol servers with built-in policy, auth, and observability.
- ⚙️ **Full-stack in TypeScript** — Agents, workflows, and UIs share the same repo and types.
- 🌍 **Deploy anywhere** — Cloudflare Workers, AWS, or local Bun/Deno runtimes.
- 🔐 **Governance built-in** — RBAC, audit trails, and spend caps from day one.
- 🔭 **Unified observability** — Trace UI clicks → agent calls → model responses.
- 🧩 **Open & modular** — Install integrations, MCP tools, or full-stack modules from the Deco marketplace.

---

## 🕸️ The MCP Mesh

The **MCP Mesh** is the backbone of Deco — a distributed runtime that manages context, connections, and observability for every agent in your system.

> Declare and compose context — aggregate connections, authorize access, and compose tools into governed, reusable capabilities.

**Core capabilities**

| Layer | Description |
|-------|--------------|
| 🧩 **MeshContext** | Unified runtime interface providing auth, storage, observability, and policy control. |
| ⚙️ **defineTool()** | Declarative API for typed, auditable, observable MCP tools. |
| 🧱 **AccessControl** | Fine-grained RBAC via Better Auth — OAuth 2.1 + API keys per workspace/project. |
| 📊 **OpenTelemetry** | Full tracing and metrics for tools, workflows, and UI interactions. |
| 💾 **Storage Adapters** | Kysely ORM → SQLite / Postgres, easily swapped. |
| ☁️ **Proxy Layer** | Secure bridge to remote MCP servers with token vault + OAuth. |
| 🧰 **Virtual MCPs** | Compose and expose governed toolsets as new MCP servers ("AI Apps"). |

_On the hosted platform, usage is metered by MCP calls._

```ts
import { z } from "zod";
import { defineTool } from "~/core/define-tool";

export const CONNECTION_CREATE = defineTool({
  name: "CONNECTION_CREATE",
  description: "Create a new MCP connection",
  inputSchema: z.object({
    name: z.string(),
    connection: z.object({
      type: z.enum(["HTTP", "SSE", "WebSocket"]),
      url: z.string().url(),
      token: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    id: z.string(),
    scope: z.enum(["workspace", "project"]),
  }),
  handler: async (input, ctx) => {
    await ctx.access.check();
    const conn = await ctx.storage.connections.create({
      projectId: ctx.project?.id ?? null,
      ...input,
      createdById: ctx.auth.user!.id,
    });
    return { id: conn.id, scope: conn.projectId ? "project" : "workspace" };
  },
});
````

✅ **Type-safe**<br/>
✅ **Audited**<br/>
✅ **Observable**<br/>
✅ **Callable via MCP**<br/>

---

## 🧱 Core Architecture
*(Mesh)*

```
apps/mesh/
├── api/               # Hono HTTP + MCP proxy
├── core/              # MeshContext, AccessControl, defineTool
├── tools/             # Built-in MCP management tools
├── storage/           # Kysely DB adapters
├── auth/              # Better Auth (OAuth + API keys)
├── observability/     # OpenTelemetry tracing & metrics
└── encryption/        # Token vault & credential management
```

**Built for scale** — runs thousands of concurrent MCP connections with predictable cost and zero vendor lock-in.

---

## ⚙️ Developer Workflow

1. **Create your project**

   ```bash
   npm create deco
   cd my-app
   npm run dev
   ```

   → runs locally at [http://localhost:8787](http://localhost:8787)

2. **Build your stack**

   * Define tools and workflows in `/server`
   * Add React + Tailwind UIs in `/view`
   * Generate typed RPC bindings with `deco gen`

3. **Deploy anywhere**

   ```bash
   deco deploy
   ```

   → edge-deployed via Cloudflare Workers or self-host with Bun/Deno.

---

## 🧩 Feature Highlights

* 🧠 **Model Context Protocol (MCP)** — Connect AI models to data/tools through governed context.
* 🪄 **Durable Workflows** — Orchestrate long-running tasks with access to any MCP.
* 🪶 **Unified TypeScript Stack** — One runtime for backend + frontend with typed RPC.
* 🔒 **Governance & FinOps** — Auth, RBAC, audit, spend caps, and policy enforcement.
* 🔭 **Observability by Design** — Logs, traces, and cost per step; debug entire flows visually.
* ⚡ **Edge-native Deployments** — Ultra-low-latency global infra via Cloudflare.
* 🧰 **Marketplace** — Reuse full-stack modules: agents + workflows + UIs.
* 🧬 **Extensible Runtime** — Add your own adapters, schemas, and MCP connectors.

---

## 🧱 AI App Framework

Build AI‑native web software on top of the Mesh:

- React 19 + Tailwind v4 + shadcn components; design‑system powered Views.
- callTool() to invoke governed Mesh tools with types and policies applied.
- Admin, dashboards, and workflow UIs that run anywhere (edge/self‑host).

## 🧩 Comparison

### vs Mastra

|               | **Mastra**                                | **DecoCMS**                                                       |
| ------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| Category      | TypeScript agent/workflow framework       | Full-stack MCP runtime + admin for AI apps                        |
| Focus         | Build agent primitives, RAG, workflows    | Ship governed agents, workflows, and UIs with RBAC, audit, FinOps |
| Protocol      | Model/provider-agnostic (LLMs, tools)     | MCP‑native runtime + proxy + policy                               |
| UI            | Code-first (framework)                    | React/Tailwind admin shell, marketplace, settings                 |
| Observability | Tracing/evals at framework level          | End‑to‑end traces UI → tools → models + spend analytics           |
| Deployment    | Node.js / serverless                      | Edge‑native (Cloudflare) + self‑host (Bun/Deno/AWS/GCP)           |


### vs Metorial

|               | **Metorial**       | **DecoCMS**                     |
| ------------- | ------------------ | ------------------------------- |
| Focus         | Connect AI to APIs | Build full-stack AI apps        |
| Language      | Go + TS            | 100 % TypeScript                |
| Infra         | Docker             | Edge / Cloudflare / Self-host   |
| Protocol      | MCP clients        | MCP-native runtime + admin      |
| Auth          | API keys           | OAuth 2.1 + RBAC + spend caps   |
| Observability | Dashboard          | Full OpenTelemetry              |
| UI            | Separate           | Shared React/Tailwind workspace |
| Goal          | Integrate          | Deploy governed AI apps fast    |

### vs Refine

|               | **Refine**                    | **DecoCMS**                               |
| ------------- | ----------------------------- | ----------------------------------------- |
| Category      | React meta-framework for CRUD | Full-stack framework for AI apps          |
| Focus         | Admin panels & dashboards     | Agents + Workflows + UIs                  |
| Architecture  | Headless UI                   | Unified backend + frontend runtime        |
| Protocol      | HTTP / REST                   | Model Context Protocol (MCP)              |
| Stack         | React + Data Providers        | TypeScript runtime + MCP Mesh             |
| Auth          | Basic auth / ACL              | Better Auth (OAuth 2.1 + API keys + RBAC) |
| Observability | Minimal                       | OpenTelemetry tracing + cost analytics    |
| Deployment    | Any React env                 | Cloudflare edge + self-host               |
| Use case      | CRUD apps / admin dashboards  | Agentic systems / governed AI apps        |

> 🧭 If you’re building internal dashboards with CRUD, use Refine.
> If you’re building production-scale AI apps with agents, workflows, custom UIs, and governance — use DecoCMS.

---

## 🧠 Tech Stack

| Layer         | Tech                                      |
| ------------- | ----------------------------------------- |
| Runtime       | Cloudflare Workers / Bun / Node / Deno    |
| Language      | TypeScript (React 19 + Tailwind v4 + Zod) |
| Framework     | Hono + Mastra + Vite                      |
| Database      | Kysely → SQLite / Postgres                |
| Auth          | Better Auth (OAuth 2.1 + API keys)        |
| Observability | OpenTelemetry + Datadog / Cloudflare Logs |
| Protocol      | Model Context Protocol (MCP)              |

---

## 🪪 License & Partners

DecoCMS ships with a Sustainable Use License (SUL). Read the full terms in [LICENSE.md](./LICENSE.md).

### For Partners (Service Providers, Software Houses, SIs, Digital Agencies)

- Free to self‑host and use to deliver client projects, as long as each deployment is for the client’s internal use (see SUL §3.3).
- Build, implement, and charge for your services — go make money, no questions asked.
- Keep your workspace private — bring your own models and data.

**Do you implement Agentic Software?** We have customers for you. Send us an email at builders@decocms.com.

### For Enterprises (Mission‑Critical or Revenue‑Generating)

- These cases require a commercial self‑hosted Enterprise license per the SUL.
- We help you deploy at scale in your cloud (AWS or GCP), with governance, observability, and performance tuned for large workloads.
- Get production support and reliability.

Questions? Contact us at [contact@decocms.com](mailto:contact@decocms.com) or visit [decocms.com](https://decocms.com).

---

## 🤝 Contributing

We welcome contributions from vibecoders, agentic engineers, and builders of the next internet.
See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, coding standards, and roadmap.

> 🧭 Upcoming milestones
>
> * Multi-tenant admin dashboard
> * MCP store
> * Edge debugger / live tracing
> * Native view components as tools

---

<div align="center">
  <sub>Made with ❤️ by the <a href="https://decocms.com">deco</a> community.<br/>
  Building the open-source operating system for AI-native apps — secure, scalable, and governed by context.</sub>
</div>
