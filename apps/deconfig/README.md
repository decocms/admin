# Deco MCP template app

A full-stack template for building
[Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/) servers
with a modern React frontend.

This template provides a complete development environment where your MCP server
not only exposes tools and workflows to AI agents but also serves a beautiful
web interface built with React and Tailwind CSS.

## 📝 Development History

This repository uses [Specstory](https://specstory.com/) to track the history of
prompts that were used to code this repo. You can inspect the complete
development history in the [`.specstory/`](.specstory/) folder.

## ✨ Features

- **🤖 MCP Server**: Cloudflare Workers-based server with typed tools and
  workflows
- **⚛️ React Frontend**: Modern React app with Vite, TanStack Router, and
  Tailwind CSS
- **🎨 UI Components**: Pre-configured shadcn/ui components for rapid
  development
- **🔧 Type Safety**: Full TypeScript support with auto-generated RPC client
  types
- **🚀 Hot Reload**: Live development with automatic rebuilding for both
  frontend and backend
- **☁️ Ready to Deploy**: One-command deployment to Cloudflare Workers

## 🚀 Quick Start

### Prerequisites

- Node.js ≥22.0.0
- [Deco CLI](https://deco.chat): `npm i -g deco-cli`

### Setup

```bash
# Install dependencies
npm install

# Configure your app
npm run configure

# Start development server
npm run dev
```

The server will start on `http://localhost:8787` serving both your MCP endpoints
and the React frontend.

## 📁 Project Structure

```
├── server/           # MCP Server (Cloudflare Workers + Deco runtime)
│   ├── main.ts      # Server entry point with tools & workflows
│   └── deco.gen.ts  # Auto-generated integration types
└── view/            # React Frontend (Vite + Tailwind CSS)
    ├── src/
    │   ├── lib/rpc.ts    # Typed RPC client for server communication
    │   ├── routes/       # TanStack Router routes
    │   └── components/   # UI components with Tailwind CSS
    └── package.json
```

## 🛠️ Development Workflow

- **`npm run dev`** - Start development with hot reload
- **`npm run gen`** - Generate types for external integrations
- **`npm run gen:self`** - Generate types for your own tools/workflows
- **`npm run deploy`** - Deploy to production

## 🔗 Frontend ↔ Server Communication

The template includes a fully-typed RPC client that connects your React frontend
to your MCP server:

```typescript
// Typed calls to your server tools and workflows
const result = await client.MY_TOOL({ input: "data" });
const workflowResult = await client.MY_WORKFLOW({ input: "data" });
```

## 📖 Learn More

This template is built for deploying primarily on top of the
[Deco platform](https://deco.chat/about) which can be found at the
[deco-cx/chat](https://github.com/deco-cx/chat) repository.

Documentation can be found at [https://docs.deco.page](https://docs.deco.page)

---

**Ready to build your next MCP server with a beautiful frontend?
[Get started now!](https://deco.chat)**
