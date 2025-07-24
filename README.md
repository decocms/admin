# deco.chat

The code for <https://deco.chat>

_An extensible, self-hosted AI workspace for building intelligent, UI-rich AI
Agents that integrate seamlessly with your internal tools and data._

## Requirements

- Deno
- Node/NPM

## How to run

By default, this project is set to use the production backend.

To use the local backend, create a `.env` file in the `apps/web` folder and add:

```
VITE_USE_LOCAL_BACKEND=true
```

You can copy the `.env.example` file as a starting point:

```
cp apps/web/.env.example apps/web/.env
```

1. Run `deno install` to install dependencies
2. Run `npm start`

---

## 🎯 What is deco.chat Agent Workspace?

**deco.chat Agent Workspace** is an open-source platform designed to empower
anyone to quickly create AI agents that don't just communicate through text—but
**through rich, interactive UI**. Text is not everything. Your agents should
visually express data, actions, and insights, leveraging an extensible chat
interface that brings powerful UI elements directly into conversations.

Agents built with deco.chat dynamically assemble themselves, connecting
automatically to thousands of high-quality, strongly-typed MCPs (**Model Context
Protocols**) available for popular databases, services, and APIs. This means
your agents seamlessly understand how to interact with your existing tools and
immediately provide value, saving you hours of setup and configuration.

---

## 🧩 Key Features

- **Interactive Chat Interface:** Deliver real-time visual interactions directly
  within the chat.
- **Golden Layout UI:** Open multiple tabs within the chat workspace for
  multitasking across forms, dashboards, maps, and live coding environments.
- **Extensive MCP Catalog:** Access thousands of high-quality MCPs for immediate
  integrations to databases, CRM, Slack, Salesforce, GitHub, and more.
- **Collaborative Agent Library:** Rapidly remix, customize, and deploy agents
  internally or within the community.

---

## 🔗 Join Our Community

- [GitHub Repository](https://github.com/deco-cx/chat)
- [Official Documentation](https://docs.deco.chat)
- [Community Discord](https://deco.cx/discord) — share ideas, seek support, and
  showcase your agents.

---

## 📚 Roadmap & Contributions

We welcome your contributions:

- [ ] Advanced memory management
- [ ] Enhanced workflow visualizations
- [ ] Rich analytics dashboards
- [ ] Expanded MCP integrations (Zapier, Notion, Airtable, etc.)

Help shape the future of UI-rich, self-building AI agents!

---

## 🛠️ Supabase Migrations

To run database migrations with Supabase:

1. Install the Supabase CLI (npm or brew, generally brew is better):
   ```sh
   npm install -g supabase
   ```
2. Log in:
   ```sh
   supabase login
   ```
3. Link the project:
   ```sh
   supabase link --project-ref $projectId
   ```
   Use `ozksgdmyrqcxcwhnbepg` for deco.cx
4. Get the database password from
   [1Password](https://decocx.1password.com/app#/v254wmdcgkot7sbjm2rrzsqgzu/Search/v254wmdcgkot7sbjm2rrzsqgzu63fbqw56r7ee5okdfbbk3s2q5a?itemListId=supabase).
5. You can create a new migration by running
   `supabase migration new $YOUR_MIGRATION_NAME`
6. Write your .sql file
7. Now you can run `deno run db:migration`
8. Remember to run `deno run db:types` to update schemas.ts

**Made with ❤️ by deco.chat**

Empowering businesses to scale AI safely, visually, and efficiently. Explore our
enterprise-grade managed solution at [deco.chat](https://deco.chat).

**Build more than just conversations—build experiences.** 🌐✨

---

## 🖥️ Using the CLI

The deco.chat CLI allows you to interact with your workspace and manage
deployments directly from your terminal.

### Installation & Login

To install the CLI, simply run:

```sh
deno install -Ar -g -n deco jsr:@deco/cli
```

Then, to use it

```sh
deco login
```

This will prompt you to log in and set up your session.

### All Commands

For a complete reference of all available commands, see the
[CLI Documentation](./packages/cli/README.md).

---