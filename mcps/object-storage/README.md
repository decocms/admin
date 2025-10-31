# Deco AI App Template

**The fastest way to build AI-powered applications with instant access to thousands of APIs.**

This is the official template used when you run `npm create deco@latest` to bootstrap your AI application. Built on the [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/), this template gives you everything you need to create powerful AI apps that can connect to any service, API, or data source.

## 🌟 What You Can Build

With this template, you can rapidly create AI applications that:

- **🔌 Connect to Thousands of APIs**: Instant integration with popular services like OpenAI, Stripe, SendGrid, databases, and more through MCP protocol
- **🤖 AI-Native Tools**: Create intelligent tools that leverage AI for data processing, analysis, and automation  
- **⚡ Real-time Collaboration**: Build collaborative AI experiences with live updates and shared state
- **🎨 Beautiful Interfaces**: Modern React frontend with Tailwind CSS and shadcn/ui components
- **🚀 Production Ready**: Deploy instantly to Cloudflare Workers with global edge distribution

## 🔥 MCP Protocol Power

The Model Context Protocol enables your AI app to seamlessly connect with:
- **External APIs** (REST, GraphQL, webhooks)
- **Databases** (PostgreSQL, MySQL, MongoDB, and more)
- **AI Services** (OpenAI, Anthropic, local models)
- **Business Tools** (CRM, analytics, payment processors)
- **Custom Integrations** (your own services and APIs)

All with **type-safe**, **auto-generated** client code and **zero configuration**.

## 📝 Development History

This repository uses [Specstory](https://specstory.com/) to track the history of
prompts that were used to code this repo. You can inspect the complete
development history in the [`.specstory/`](.specstory/) folder.

## ✨ Template Features

- **🤖 MCP Server**: Cloudflare Workers-based server with typed AI tools
- **⚛️ React Frontend**: Modern React app with Vite, TanStack Router, and Tailwind CSS
- **🎨 UI Components**: Pre-configured shadcn/ui components for rapid development
- **🔧 Type Safety**: Full TypeScript support with auto-generated RPC client types
- **🚀 Hot Reload**: Live development with automatic rebuilding for both frontend and backend
- **☁️ Ready to Deploy**: One-command deployment to Cloudflare Workers
- **🔗 API Integrations**: Connect to thousands of services through deco marketplace
- **🛡️ Built-in Auth**: OAuth integration with popular providers (Google, GitHub, etc.)
- **🗄️ Integrated Database**: SQLite database with 10GB storage included in every project

## 🚧 Coming Soon: Visual Workflow Editor

We're finishing our **visual workflow editor** where you'll be able to:
- **🎨 Drag & Drop**: Compose AI tools visually with an intuitive interface
- **🤝 Real-time Collaboration**: Work together on workflows with your team
- **🧠 AI-Generated Workflows**: Let AI help you build complex automation flows
- **⚡ Live Preview**: See your workflows in action as you build them

*This will revolutionize how you create AI-powered automation and data processing pipelines.*

## 🚀 Quick Start

### Two Ways to Create Your AI App

#### Option 1: Using npm create (Recommended)

```bash
# Create a new AI app from this template
npm create deco@latest my-ai-app

# Navigate to your project
cd my-ai-app

# Configure your app (sets name, scope, and workspace)
npm run configure

# Start development server
npm run dev
```

#### Option 2: Using GitHub Template

You can also create a new app by using this repository as a GitHub template:

1. Click "Use this template" on GitHub to create a new repository
2. Clone your new repository
3. Install dependencies and configure:

```bash
git clone <your-new-repo-url>
cd <your-new-repo>

# Install dependencies
npm install

# Configure your app (REQUIRED - sets name, scope, and workspace)
npm run configure

# Start development server
npm run dev
```

The server will start on `http://localhost:8787` serving both your MCP endpoints and the React frontend.

### Prerequisites

- **Node.js ≥22.0.0**
- **Deco CLI** - Required for development and deployment:
  ```bash
  npm install -g deco-cli
  ```
- **Deco Account** - Sign up at [admin.decocms.com](https://admin.decocms.com/)

### ⚠️ Important Setup Note

After creating your app (via npm create or GitHub template), you must:

1. **Install Deco CLI globally**: 
   ```bash
   npm install -g deco-cli
   ```

2. **Login to Deco**:
   ```bash
   deco login
   ```

3. **Configure your app** (REQUIRED before first use):
   ```bash
   npm run configure
   ```
   
   This configures:
   - **App name**: Determines your deployment URL (`<app-name>.deco.page`)
   - **Scope**: Maps to your deco organization/project
   - **Workspace**: Maps to your deco organization/project

4. **Deploy** to enable OAuth authentication:
   ```bash
   npm run deploy
   ```

**Note**: The template comes with default values (`name = "deco-create"`, `scope = "kmute"`). You must run `npm run configure` to set your own values before development or deployment.

## 📁 Project Structure

```
├── server/           # MCP Server (Cloudflare Workers + Deco runtime)
│   ├── main.ts      # Server entry point with AI tools
│   ├── tools/       # Domain-organized AI tools
│   └── deco.gen.ts  # Auto-generated integration types
└── view/            # React Frontend (Vite + Tailwind CSS)
    ├── src/
    │   ├── lib/rpc.ts    # Typed RPC client for server communication
    │   ├── routes/       # TanStack Router routes
    │   └── components/   # UI components with Tailwind CSS
    └── package.json
```

## 🛠️ Development Commands

- **`npm run dev`** - Start development with hot reload
- **`npm run gen`** - Generate types for external integrations  
- **`npm run deploy`** - Deploy to production
- **`npm run configure`** - Configure your app and workspace

## 🔗 Frontend ↔ Server Communication

The template includes a fully-typed RPC client that connects your React frontend to your MCP server:

```typescript
// Typed calls to your AI tools
const result = await client.MY_AI_TOOL({ input: "data" });
const analysis = await client.ANALYZE_DATA({ dataset: data });
```

## 🌐 API Integration System

Connect to thousands of services instantly through your [deco project](https://admin.decocms.com/):

- **🤖 AI Services**: OpenAI, Anthropic, Cohere, local models
- **💳 Payments**: Stripe, PayPal, Square
- **📧 Communication**: SendGrid, Twilio, Slack
- **🗄️ Databases**: PostgreSQL, MongoDB, Redis, Supabase
- **📊 Analytics**: Google Analytics, Mixpanel, Segment
- **And thousands more...**

### Adding Integrations

All apps installed in your [deco project](https://admin.decocms.com/) can be used to create new tools or views:

1. **Install apps** in your deco project dashboard
2. **Run integration**: `npm run configure` or `bun run configure` 
3. **Auto-generated types**: MCP types are downloaded to `shared/deco.gen.ts`
4. **Start building**: Use the typed clients in your tools immediately

All integrations come with auto-generated TypeScript types and zero-config setup.

## 🗄️ Integrated Database

Every deco project includes a **SQLite database with 10GB storage**:

- **Zero setup**: Database is ready to use out of the box
- **Type-safe ORM**: Built-in Drizzle ORM with TypeScript support
- **Automatic migrations**: Schema changes are applied automatically
- **Production ready**: Scales with your application needs

Perfect for storing user data, application state, and business logic without external database setup.

## 🎯 Example Use Cases

Build powerful AI applications like:

- **📊 Data Analysis Tools**: Connect to databases and APIs to analyze business data with AI
- **🤖 Customer Support Bots**: Integrate with CRM and support systems for intelligent assistance  
- **📝 Content Generation**: Combine AI with content management systems and social media APIs
- **💼 Business Automation**: Create workflows that connect multiple services and automate tasks
- **🔍 Research Assistants**: Build tools that gather and analyze information from multiple sources
- **📈 Analytics Dashboards**: Create AI-powered insights from your business data

## 📖 Resources

- **🚀 Get Started**: [Create your first AI app](https://decocms.com/)
- **📚 Documentation**: [docs.deco.page](https://docs.deco.page)
- **💬 Community**: [Join our Discord](https://discord.gg/deco)
- **🐙 Source Code**: [deco-cx/deco](https://github.com/deco-cx/deco)

## 💡 Development Tip

Consider using [SpecStory](https://specstory.com/) in your AI editor to track your development history and prompts as you build your AI application. It's a great way to document your development process and share knowledge with your team.

---

**Ready to build the next generation of AI applications?**

[🚀 **Start Building Now**](https://decocms.com/) • [📖 **Read the Docs**](https://docs.deco.page) • [💬 **Join Community**](https://discord.gg/deco)
