<img width="2400" height="750" alt="image" src="https://github.com/user-attachments/assets/d3e36c98-4609-46d3-b39f-7ee1c6d77432" />

# decocms.com 

**decocms** is an open-source foundation for building AI-native software.\
We equip developers, engineers, and AI enthusiasts with robust tools to rapidly
prototype, develop, and deploy AI-powered applications.

**Official docs:** https://docs.deco.page

> [!TIP]
> If you have questions or want to learn more, please join our discord
> community: https://decocms.com/discord

## Who is it for?

- **Vibecoders** prototyping ideas
- **Agentic engineers** deploying scalable, secure, and sustainable production
  systems

## Why deco CMS?

Our goal is simple: empower teams with Generative AI by giving builders the
tools to create AI applications that scale beyond the initial demo and into the
thousands of users, securely and cost-effectively.

<img width="1440" height="900" alt="image" src="https://assets.decocache.com/decochatweb/3c37a237-0c33-4db5-9cfd-a11ff084752a/decocx1.png" />

## Core capabilities

- **Open-source Runtime** – Easily compose tools, workflows, and views within a
  single codebase
- **MCP Mesh (Model Context Protocol)** – Securely integrate models, data
  sources, and APIs, with observability and cost control
- **Unified TypeScript Stack** – Combine backend logic and custom React/Tailwind
  frontends seamlessly using typed RPC
- **Global, Modular Infrastructure** – Built on Cloudflare for low-latency,
  infinitely scalable deployments. Self-host with your Cloudflare API Key
- **Visual Workspace** – Build agents, connect tools, manage permissions, and
  orchestrate everything built in code

<img width="1440" height="900" alt="image" src="https://assets.decocache.com/decochatweb/2e6980db-296b-4972-b2d4-9f5265b6e74a/Usage-by-agent.png" />

---

## Creating a new Deco project

A Deco project extends a standard Cloudflare Worker with our building blocks and
defaults for MCP servers.\
It runs a type-safe API out of the box and can also serve views — front-end apps
deployed alongside the server.

Currently, views can be any Vite app that outputs a static build. Soon, they’ll
support components declared as tools, callable by app logic or LLMs.\
Views can call server-side tools via typed RPC.

### Requirements

- Your preferred JavaScript runtime:
  - Recommended: [Bun](https://bun.sh)
  - Supported: [Node.js](https://nodejs.org), [Deno](https://deno.land)

### Quick Start

1. Create your project

```
npm create deco
```

or

```
bun create deco
```

> This will prompt you to log in or to create an account on
> [decocms.com](https://decocms.com).

2. Enter the project directory and start the dev server

```
cd <my-project-directory>
npm install
npm run dev               # → http://localhost:8787 (hot reload)
```

> Need pre‑built MCP integrations? Explore
> [deco-cx/apps](https://github.com/deco-cx/apps).

## Project Layout

```
my-project/
├── server/         # MCP tools & workflows (Cloudflare Workers)
│   ├── main.ts
│   ├── deco.gen.ts  # Typed bindings (auto-generated)
│   └── wrangler.toml
├── view/           # React + Tailwind UI (optional)
│   └── src/
├── package.json    # Root workspace scripts
└── README.md
```

> Skip `view/` if you don’t need a frontend.

## CLI Essentials

| Command         | Purpose                                  |
| --------------- | ---------------------------------------- |
| `deco dev`      | Run server & UI with hot reload          |
| `deco deploy`   | Deploy to Cloudflare Workers             |
| `deco gen`      | Generate types for external integrations |
| `deco gen:self` | Generate types for your own tools        |

> For full command list: `deco --help` or see the
> [CLI README](packages/cli/README.md)

## Building Blocks

A Deco project is built using **tools** and **workflows** — the core primitives
for connecting integrations, APIs, models, and business logic.

### Tools

Atomic functions that call external APIs, databases, or AI models. All templates
include the necessary imports from the Deco Workers runtime.

```ts
import { createTool, Env, z } from "deco/mod.ts";

const createMyTool = (env: Env) =>
  createTool({
    id: "MY_TOOL",
    description: "Describe what it does",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ answer: z.string() }),
    execute: async ({ context }) => {
      const res = await env.OPENAI.CHAT_COMPLETIONS({
        model: "gpt-4o",
        messages: [{ role: "user", content: context.query }],
      });
      return { answer: res.choices[0].message.content };
    },
  });
```

> Tools can be used independently or within workflows. **Golden rule:** one tool
> call per step — keep logic in the workflow.

---

### Workflows

Orchestrate tools using **Mastra** operators like `.then`, `.parallel`,
`.branch`, and `.dountil`.

> Tip: Add [Mastra docs](https://github.com/deco-cx/mastra) to your AI code
> assistant for autocomplete and examples.

```ts
import { createStepFromTool, createWorkflow } from "deco/mod.ts";

return createWorkflow({
  id: "HELLO_WORLD",
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
})
  .then(createStepFromTool(createMyTool(env)))
  .map(({ inputData }) => ({ greeting: `Hello, ${inputData.answer}!` }))
  .commit();
```

---

### Views

Build **React + Tailwind** frontends served by the same Cloudflare Worker.

- Routing with [TanStack Router](https://tanstack.com/router)
- Typed RPC via `@deco/workers-runtime/client`
- Preconfigured with `shadcn/ui` and `lucide-react`

---

## Development Flow

1. Add an integration via the [decocms.com dashboard](https://decocms.com)
   _(improved UX coming soon)_
2. Run `npm run gen` → updates `deco.gen.ts` with typed clients
3. Write tools in `server/main.ts`
4. Compose workflows using `.map`, `.branch`, `.parallel`, etc.
5. _(Optional)_ Run `npm run gen:self` → typed RPC clients for your tools
6. Build views in `/view` and call workflows via the typed client
7. Run locally

   ```bash
   npm run dev   # → http://localhost:8787
   ```

8. Deploy to Cloudflare

   ```bash
   npm run deploy
   ```

---

## How to Contribute (WIP)

We welcome contributions! Check out [`CONTRIBUTING.md`](./CONTRIBUTING.md) for
guidelines and tips.

---

Made with ❤️ by the Deco community — helping teams build AI-native systems that
scale.
