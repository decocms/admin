# Deco CLI

A command-line interface for managing deco.chat applications and workspaces.

## Installation

```bash
deno install -Ar -g -n deco jsr:@deco/cli
```

## Commands

### Authentication

#### `deco login`

Log in to deco.chat and retrieve tokens for CLI usage.

#### `deco logout`

Log out of deco.chat and remove local session data.

#### `deco whoami`

Print information about the current session.

### Configuration

#### `deco configure`

Save configuration options for the current directory. This command will prompt
you for:

- Workspace name
- App name

### Hosting

#### `deco deploy`

Deploy the current directory into the current workspace.

Options:

- `-w, --workspace <workspace>`: Workspace name (optional)
- `-a, --app <app>`: App name (optional)
- `-l, --local`: Deploy the app locally (requires deco.chat running at local API
  endpoint)

#### `deco hosting list -w <workspace>`

List all apps in the specified workspace.

### Development

#### `deco link`

Link the project to be accessed through a remote domain.

Options:

- `-p, --port <port>`: Port to link (optional)

Usage:

```bash
deco link [build-command]
```

Example:

```bash
deco link npm run dev
```

### Maintenance

#### `deco update`

Update the deco CLI to the latest version.

## Environment Variables

- `DECO_CHAT_API_TOKEN`: Authentication token for API access
- `DECO_CHAT_API_LOCAL`: Local API endpoint for development

## Configuration File

The CLI uses a configuration file to store workspace and app settings. You can
set these values using the `deco configure` command.
