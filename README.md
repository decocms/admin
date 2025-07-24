# deco.chat

**deco.chat** is an open-source foundation for building AI-native software.  
We equip developers, engineers, and AI enthusiasts with robust tools to rapidly prototype, develop, and deploy AI-powered applications.

**Official docs:** https://docs.deco.chat


## Who is it for?

- **Vibecoders** prototyping ideas  
- **Agentic engineers** deploying scalable, secure, and sustainable production systems  


## Why deco.chat?

Our goal is simple: empower teams to embrace Generative AI by giving builders the tools to create sustainable, governed AI-native applications — from prototype to production, and from one user to thousands.


## Core capabilities

- **Open-source Runtime** – Easily compose tools, workflows, and views within a single codebase  
- **MCP Mesh (Model Context Protocol)** – Securely integrate models, data sources, and APIs, with observability and cost control  
- **Unified TypeScript Stack** – Combine backend logic and custom React/Tailwind frontends seamlessly using typed RPC  
- **Global, Modular Infrastructure** – Built on Cloudflare for low-latency, infinitely scalable deployments. Self-host with your Cloudflare API Key  
- **Visual Workspace** – Build agents, connect tools, manage permissions, and orchestrate everything built in code  

---


## Creating a new Deco project

A Deco project extends a standard Cloudflare Worker with our building blocks and defaults for MCP servers.  
It runs a type-safe API out of the box and can also serve views — front-end apps deployed alongside the server.

Currently, views can be any Vite app that outputs a static build. Soon, they’ll support components declared as tools, callable by app logic or LLMs.  
Views can call server-side tools via typed RPC.


### Requirements

- [Deno](https://docs.deno.com/runtime/) 2.x.x *(temporary — will be optional after CLI migration)*  
- Your preferred JavaScript runtime:  
  - Recommended: [Bun](https://bun.sh)  
  - Supported: [Node.js](https://nodejs.org), [Deno](https://deno.land)



### Quick Start

1. Install the CLI

```
deno install -Ar -g -n deco jsr:@deco/cli
```

2. Log in to [deco.chat](https://deco.chat).
Don’t have an account? Sign up first.

3. Create a new project

```
deco create              # create new project, select workspace and choose a template
cd my-project
npm install              # or pnpm install (for view dependencies)
```

4. Start the dev server

```
npm run dev               # → http://localhost:8787 (hot reload)
```

> Need pre‑built MCP integrations? Explore [deco-cx/apps](https://github.com/deco-cx/apps).



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

> For full command list: `deco --help` or see the [CLI README](packages/cli/README.md)



## Building Blocks

A Deco project is built using **tools** and **workflows** — the core primitives for connecting integrations, APIs, models, and business logic.



### Tools

Atomic functions that call external APIs, databases, or AI models.
All templates include the necessary imports from the Deco Workers runtime.

```ts
import { createTool, z, Env } from "deco/mod.ts";

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

> Tools can be used independently or within workflows.
> **Golden rule:** one tool call per step — keep logic in the workflow.

---

### Workflows

Orchestrate tools using **Mastra** operators like `.then`, `.parallel`, `.branch`, and `.dountil`.

> Tip: Add [Mastra docs](https://github.com/deco-cx/mastra) to your AI code assistant for autocomplete and examples.

```ts
import { createWorkflow, createStepFromTool } from "deco/mod.ts";

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

* Routing with [TanStack Router](https://tanstack.com/router)
* Typed RPC via `@deco/workers-runtime/client`
* Preconfigured with `shadcn/ui` and `lucide-react`

---

## Development Flow

1. Add an integration via the [deco.chat dashboard](https://deco.chat) *(improved UX coming soon)*
2. Run `npm run gen` → updates `deco.gen.ts` with typed clients
3. Write tools in `server/main.ts`
4. Compose workflows using `.map`, `.branch`, `.parallel`, etc.
5. *(Optional)* Run `npm run gen:self` → typed RPC clients for your tools
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

## How to Contribute

We welcome contributions!
Check out [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines and tips.

---

Made with ❤️ by the Deco community — helping teams build AI-native systems that scale.
