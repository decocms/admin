# Deco CLI Reference

The Deco CLI is your interface for managing AI-native projects built with
[deco.chat](https://deco.chat).

Official docs: https://docs.deco.page/

---

## Authentication

| Command       | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `deco login`  | Authenticate and store an API token for subsequent commands. |
| `deco logout` | Remove local credentials and end the session.                |
| `deco whoami` | Show the currently authenticated user and workspace.         |

---

## Project Management

| Command          | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `deco create`    | Scaffold a new deco project from an official template.                      |
| `deco configure` | Re-run setup for the current directory to change workspace or app settings. |

---

## Development

| Command                     | Description                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Preferred way to run local Worker and React frontend in watch mode.                                  |
| `deco dev`                  | (Experimental) Future unified development command.                                                   |
| `deco link [build-command]` | Link your local dev server to a public domain. Supports `-p <port>`. Example: deco link npm run dev. |

---

## Type Generation

| Command         | Description                                                                |
| --------------- | -------------------------------------------------------------------------- |
| `deco gen`      | Generate types for external integrations (`deco.gen.ts`).                  |
| `deco gen:self` | Generate types for your own tools and workflows via local `/mcp` endpoint. |

---

## Hosting & Deployment

| Command                       | Description                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `npm run deploy`              | Builds frontend and invokes `deco deploy`. Recommended for most use cases. |
| `deco deploy`                 | Bundle and deploy to Cloudflare Workers. Supports `-w`, `-a`, and `-l`.    |
| `deco hosting list -w <name>` | List deployed apps in a specific workspace.                                |

---

## Integrations

| Command    | Description                                   |
| ---------- | --------------------------------------------- |
| `deco add` | Add and configure workspace integrations.     |

---

## Maintenance

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `deco update` | Upgrade the CLI to the latest published version. |

---

## Getting Help

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `deco --help` | Display the full list of CLI commands and usage. |

---

## Configuration File

The CLI uses a local config file to store your workspace and app context.
Set or update this configuration anytime using: `deco configure`

---

## Environment Variables

| Variable              | Purpose                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `DECO_CHAT_API_TOKEN` | API token for authentication (set by `deco login`).                   |
| `DECO_CHAT_API_LOCAL` | Overrides API base URL for local development.                         |
| `DECO_SELF_URL`       | Local MCP endpoint for `deco gen:self` to introspect workflows/tools. |
