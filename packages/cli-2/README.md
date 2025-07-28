# Deco CLI (Node.js Port)

A Node.js CLI for managing deco.chat applications and workspaces. This is a port
of the original Deno-based CLI to Node.js for npm distribution.

## 🎉 CURRENT STATUS (Updated 2025-07-28)

**STATUS: MOSTLY COMPLETE** ✅ **with 2 Missing Commands**

### ✅ COMPLETED (11/13 Major Commands)

#### Phase 1: Project Setup ✅

- [x] Create package structure
- [x] Set up TypeScript configuration
- [x] Define package.json with Node.js dependencies
- [x] Map Deno dependencies to Node.js equivalents

#### Phase 2: Core Infrastructure ✅

- [x] Port authentication system (`login`, `logout`, `whoami`)
- [x] Port configuration management
- [x] Port session management with file-based storage
- [x] Port Supabase client integration
- [x] Port MCP (Model Context Protocol) client

#### Phase 3: Command Framework Migration ✅

- [x] Replace Cliffy commands with Commander.js
- [x] Replace Cliffy prompts with Inquirer.js
- [x] Port all command definitions and handlers
- [x] Implement proper CLI argument parsing

#### Phase 4: Core Commands ✅

- [x] Port `configure` command with workspace/app setup
- [x] Port `create` command with project templates
- [x] Port `dev` command for development server
- [x] Port `link` command for remote domain access

#### Phase 5: Hosting & Deployment ✅

- [x] Port `deploy` command with file upload
- [x] Port Wrangler integration for Cloudflare Workers
- [x] Port environment variable management

#### Phase 6: File System & Path Handling ✅

- [x] Replace Deno file system APIs with Node.js fs.promises
- [x] Implement utility functions for `ensureDir`, `copy`, and `walk`
- [x] Replace Deno path APIs with Node.js path module
- [x] Port directory walking and file filtering logic
- [x] Handle cross-platform path differences

#### Phase 7: Network & External Services ✅

- [x] Port HTTP server for OAuth callback handling
- [x] Port WebSocket connections for `link` command with @deco/warp
- [x] Maintain compatibility with deco.chat API

## 🚀 DETAILED COMMAND STATUS

### ✅ COMPLETED COMMANDS (11/13)

- ✅ `deco login` - OAuth authentication flow
- ✅ `deco logout` - Session cleanup
- ✅ `deco whoami` - User info display
- ✅ `deco configure` - Project configuration
- ✅ `deco create [name] --template [template]` - Project scaffolding with
  workspace selection + search
- ✅ `deco templates` - List available templates
- ✅ `deco deploy` - Full deployment with file upload
- ✅ `deco dev` - Development server with tunnel
- ✅ `deco link` - Remote domain tunneling
- ✅ `deco gen` - TypeScript type generation from MCP integrations
- ✅ `deco hosting list` - List apps in workspace

### 🚨 MISSING COMMANDS (2/13)

- ❌ `deco add` - **Integration management** (HIGH PRIORITY)
  - Interactive selection of integrations from workspace
  - Multiple integration selection with search functionality
  - Automatic binding name generation with validation
  - Writes configuration to wrangler.toml
  - **Current status**: Placeholder only

- ❌ `deco update` - **CLI self-update** (MEDIUM PRIORITY)
  - Automatic version checking against registry
  - Interactive upgrade prompts with version comparison
  - **Current status**: Placeholder only

### 🔧 RECENT IMPROVEMENTS (This Session)

- ✅ **Fixed workspace selection search** - Added `inquirer-search-list` plugin
  support
- ✅ **Fixed wrangler.toml merging** - Proper config preservation during project
  creation
- ✅ **Fixed process hanging** - Added proper MCP client cleanup in `genEnv`
  function
- ✅ **Enhanced create command** - Now includes automatic TypeScript generation
  and IDE setup

### Project Structure:

```
cli-2/
├── src/
│   ├── cli.ts              ✅ Main CLI entry point
│   ├── lib/                ✅ Core libraries
│   │   ├── config.ts       ✅ Configuration management
│   │   ├── session.ts      ✅ Session management
│   │   ├── supabase.ts     ✅ Supabase client
│   │   ├── mcp.ts          ✅ MCP client
│   │   ├── wrangler.ts     ✅ Wrangler utilities
│   │   ├── fs.ts           ✅ File system utilities
│   │   ├── slugify.ts      ✅ String utilities
│   │   └── constants.ts    ✅ Constants
│   └── commands/           ✅ Command implementations
│       ├── auth/           ✅ login, logout, whoami
│       ├── config/         ✅ configure
│       ├── create/         ✅ create, templates
│       ├── hosting/        ✅ deploy
│       └── dev/            ✅ dev, link
├── template/               ✅ Project templates
├── dist/                   ✅ Compiled output
└── package.json            ✅ Node.js dependencies
```

## 🔧 TECHNICAL NOTES FOR NEXT SESSION

### Priority Implementation Tasks:

1. **HIGH PRIORITY: Implement `deco add` command**
   - **Missing file**: `/src/lib/promptIntegrations.js` - Integration selection
     utilities
   - **Source reference**: `/Users/viktor/repos/chat/packages/cli/src/add.ts`
   - **Source utils**:
     `/Users/viktor/repos/chat/packages/cli/src/utils/prompt-integrations.ts`
   - **Functionality needed**:
     - Fetch integrations from workspace using MCP client
     - Multi-select interface with search (using `inquirer-search-checkbox`)
     - Automatic binding name generation and validation
     - Write bindings to wrangler.toml via existing config system

2. **MEDIUM PRIORITY: Implement `deco update` command**
   - **Missing file**: Update mechanism for Node.js CLI
   - **Source reference**:
     `/Users/viktor/repos/chat/packages/cli/src/upgrade.ts`
   - **Functionality needed**:
     - Version checking against npm registry (instead of JSR)
     - Interactive upgrade prompts
     - npm-based installation instead of Deno install

### Known Working Issues:

- ✅ **@deco/warp Integration**: Working correctly (fixed in this session)
- ✅ **MCP IDE setup prompts**: Implemented in `/src/lib/promptIDESetup.js`
- ✅ **Environment type generation**: Implemented in `/src/commands/gen/gen.js`
- ✅ **Workspace prompts**: Implemented in `/src/lib/promptWorkspace.js` with
  search

### Dependencies Successfully Mapped:

- `@cliffy/command` → `commander` ✅
- `@cliffy/prompt` → `inquirer` ✅
- `@std/fs` → `fs.promises` + custom utilities ✅
- `@std/path` → `path` ✅
- `@std/fmt/colors` → `chalk` ✅
- `smol-toml` → `smol-toml` ✅
- `@deco/warp` → `@deco/warp` (JSR) ⚠️ (needs Node.js fix)

### Build & Run Commands:

```bash
npm run build      # Compile TypeScript
npm run dev        # Run in development
npm run start      # Run compiled CLI
npm run type-check # TypeScript validation
```

**🎯 PRODUCTION READY WITH LIMITATIONS** - The CLI has 11/13 commands fully
working and ready for production use. The 2 missing commands (`add` and
`update`) are non-critical for basic usage but important for advanced
integration management.

## Key Migration Challenges

### Dependency Mapping

| Deno Library      | Node.js Equivalent | Status       |
| ----------------- | ------------------ | ------------ |
| `@cliffy/command` | `commander`        | ✅ Mapped    |
| `@cliffy/prompt`  | `inquirer`         | ✅ Mapped    |
| `@std/fs`         | `fs.promises`      | ✅ Mapped    |
| `@std/path`       | `path` (built-in)  | ✅ Mapped    |
| `@std/fmt/colors` | `chalk`            | ✅ Mapped    |
| `@std/semver`     | `semver`           | ✅ Mapped    |
| `@std/dotenv`     | `dotenv`           | ✅ Available |
| `smol-toml`       | `toml`             | ✅ Mapped    |

### Runtime Differences

1. **Import System**: Convert from Deno's URL imports to Node.js module
   resolution
2. **JSON Imports**: Handle JSON file imports differently (using fs.readFile +
   JSON.parse)
3. **Permissions**: Remove Deno permission flags, rely on Node.js file system
   access
4. **Process Spawning**: Convert from `Deno.Command` to Node.js `child_process`
5. **Environment Variables**: Use `process.env` instead of `Deno.env`

### File Structure Changes

```
cli-2/
├── src/
│   ├── cli.ts              # Main CLI entry point
│   ├── commands/           # Command implementations
│   │   ├── auth/          # login, logout, whoami
│   │   ├── config/        # configure command
│   │   ├── create/        # project creation
│   │   ├── deploy/        # hosting and deployment
│   │   ├── dev/          # development commands
│   │   └── utils/        # shared utilities
│   ├── lib/              # Core libraries
│   │   ├── config.ts     # Configuration management
│   │   ├── session.ts    # Session management
│   │   ├── supabase.ts   # Supabase client
│   │   └── mcp.ts        # MCP client
│   └── types/            # TypeScript definitions
├── template/             # Project templates
├── dist/                 # Compiled output
└── package.json
```

## Implementation Strategy

1. **Incremental Migration**: Port one command at a time, starting with
   authentication
2. **Maintain API Compatibility**: Ensure the CLI interface remains identical
3. **Preserve Functionality**: All existing features must work in Node.js
   version
4. **Testing Strategy**: Validate each command against the original Deno version
5. **Documentation**: Update all examples and installation instructions

## Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

## Implementation Progress (11/13 Complete)

| Command              | Status         | Implementation File                 | Notes                            |
| -------------------- | -------------- | ----------------------------------- | -------------------------------- |
| `deco login`         | ✅ Complete    | `/src/commands/auth/login.ts`       | OAuth flow working               |
| `deco logout`        | ✅ Complete    | `/src/commands/auth/logout.ts`      | Session cleanup                  |
| `deco whoami`        | ✅ Complete    | `/src/commands/auth/whoami.ts`      | User info display                |
| `deco configure`     | ✅ Complete    | `/src/commands/config/configure.ts` | Project setup                    |
| `deco create [name]` | ✅ Complete    | `/src/commands/create/create.ts`    | Enhanced with search + IDE setup |
| `deco templates`     | ✅ Complete    | `/src/commands/create/create.ts`    | Template listing                 |
| `deco dev`           | ✅ Complete    | `/src/commands/dev/dev.ts`          | Development server               |
| `deco deploy`        | ✅ Complete    | `/src/commands/hosting/deploy.ts`   | File upload working              |
| `deco hosting list`  | ✅ Complete    | `/src/commands/hosting/list.ts`     | App listing                      |
| `deco link [cmd]`    | ✅ Complete    | `/src/commands/dev/link.ts`         | Remote access tunneling          |
| `deco gen`           | ✅ Complete    | `/src/commands/gen/gen.ts`          | TypeScript generation            |
| `deco add`           | ❌ **Missing** | Placeholder only                    | **HIGH PRIORITY**                |
| `deco update`        | ❌ **Missing** | Placeholder only                    | **MEDIUM PRIORITY**              |

The goal is feature parity with the Deno version while leveraging the Node.js
ecosystem for better npm distribution and broader compatibility.
