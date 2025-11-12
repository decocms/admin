# MCP Project Import/Export - Implementation Summary

## Overview
Implemented CLI-first import/export functionality for MCP projects (AI Apps), allowing users to export projects to disk and import them into different organizations.

## What Was Implemented

### 1. Core Schema and Types (`packages/sdk/src/mcp/projects/`)

#### `manifest.ts`
- Zod schemas for the `deco.mcp.json` manifest file
- TypeScript interfaces for type safety
- Helper functions: `createManifest()`, `parseManifest()`, `isValidManifest()`
- Schema version: `1.0`
- Fields:
  - `project`: slug, title, description
  - `author`: orgSlug, orgId, userId, userEmail
  - `resources`: tools[], views[], workflows[], documents[], databaseSchemasDoc?
  - `dependencies`: mcps[] (informational only)
  - `createdAt`: ISO timestamp

#### `db-schemas.ts`
- Zod schemas for database schema documents (`src/documents/deco.db.schemas.json`)
- Generic dialect for portability
- Helper functions: `parseDbSchemasDocument()`, `getTableNames()`, `filterTablesByNames()`
- Structure:
  - `version`: number
  - `dialect`: "generic"
  - `tables`: array of table definitions with columns and indexes

### 2. CLI Helpers (`packages/cli/src/lib/`)

#### `prompt-project.ts`
- Interactive project selector using inquirer
- Integrates with `PROJECTS_LIST` MCP tool
- Returns full project metadata (id, slug, title, description)

#### `mcp-manifest.ts`
- Read/write manifest files to/from disk
- Validate manifest against schema
- Extract MCP dependencies from tool JSON files (best-effort parsing)
- Helper to check if manifest exists in a directory

### 3. CLI Commands (`packages/cli/src/commands/projects/`)

#### `export.ts` - Export Command
**Usage:** `deco project export [options]`

**Options:**
- `--org <slug>`: Organization slug (prompts if not provided)
- `--project <slug>`: Project slug (prompts if not provided)
- `--out <dir>`: Output directory (prompts if not provided, default: `./<org>__<project>/`)
- `--db-schemas <mode>`: Database schema export mode: `all`, `none`, `select` (default: `select`)

**Flow:**
1. Authenticate and select org/project (via prompts or flags)
2. Create output directory (fails if non-empty without --force)
3. Connect to project workspace (`/${org}/${project}`)
4. Fetch all files from allowed roots via `LIST_FILES` and `READ_FILE`:
   - `/src/tools/`
   - `/src/views/`
   - `/src/workflows/`
   - `/src/documents/`
5. Write files to disk **removing `/src/` prefix** for cleaner structure
6. **Export agents**:
   - List agent IDs via `AGENTS_LIST` tool
   - Fetch full details for each agent via `AGENTS_GET` (ensures all fields like instructions, tools_set, memory are included)
   - Strip environment fields (id, workspace, timestamps)
   - Save to `agents/{sanitized-name}.json`
   - Progress indicators every 5 agents
7. Handle database schemas:
   - If `deco.db.schemas.json` exists:
     - `--db-schemas=none`: skip
     - `--db-schemas=all`: include all tables
     - `--db-schemas=select`: prompt user to select tables (multi-select)
   - Filter and write selected tables to output
8. Extract MCP dependencies from tool files
9. Fetch author info via `PROFILES_GET`
10. Build and write `deco.mcp.json` manifest
11. Print summary (counts, dependencies, output path, **agent count**)

#### `import.ts` - Import Command
**Usage:** `deco project import [options]`

**Options:**
- `--from <dir>`: Source directory (default: `./`)
- `--org <slug>`: Destination organization slug (prompts if not provided)
- `--slug <slug>`: Override project slug from manifest
- `--title <title>`: Override project title from manifest

**Flow:**
1. Validate source directory exists
2. Read and validate `deco.mcp.json` manifest
3. Derive project metadata (with overrides from flags)
4. Select destination organization
5. Create project via `PROJECTS_CREATE`:
   - Handle slug collisions: prompt for new slug or abort
6. Push files to new project:
   - Walk allowed roots in source directory (`/tools`, `/views`, `/workflows`, `/documents`)
   - **Add `/src/` prefix when uploading** to match Deconfig structure
   - Validate JSON files (skip malformed)
   - Detect binary content (skip with warning)
   - Upload via `PUT_FILE` to `main` branch
7. **Import agents** via `AGENTS_CREATE` tool:
   - Switch to project workspace context
   - Read `agents/*.json` files
   - Call `AGENTS_CREATE` for each (side effect, not file upload)
   - Track successes/failures
8. Print summary:
   - Project ID, slug, organization
   - Files uploaded count
   - **Agents created count**
   - Database schemas status (included but not applied)
   - Dependencies list (informational, not installed)

### 4. CLI Integration (`packages/cli/src/commands.ts`)

Added new parent command `project` with subcommands:
- `deco project export` - Export a project
- `deco project import` - Import a project

## Project Structure on Disk

```
my-project/
├── deco.mcp.json                    # Manifest file
├── agents/                          # Agent definitions
│   ├── customer-support.json        # Individual agent configs
│   └── data-analyst.json
├── tools/                           # Tool definitions (no src/ prefix!)
│   ├── FETCH_TODOS.json
│   └── CREATE_TODO.json
├── views/                           # View definitions
│   └── todo_list_view.json
├── workflows/                       # Workflow definitions
└── documents/                       # Document files
    ├── readme.json
    └── deco.db.schemas.json         # Database schemas (optional)
```

## Example Manifest (`deco.mcp.json`)

```json
{
  "schemaVersion": "1.0",
  "project": {
    "slug": "todo-app",
    "title": "Todo App",
    "description": "A native todo list application"
  },
  "author": {
    "orgSlug": "acme",
    "userId": "user-123",
    "userEmail": "user@example.com"
  },
  "resources": {
    "tools": ["/tools/create-todo.json", "/tools/list-todos.json"],
    "views": ["/views/todo-list.json"],
    "workflows": [],
    "documents": ["/documents/deco.db.schemas.json"],
    "databaseSchemasDoc": "/documents/deco.db.schemas.json"
  },
  "dependencies": {
    "mcps": []
  },
  "createdAt": "2025-11-04T12:34:56.789Z"
}
```

## Example Database Schema Document

```json
{
  "version": 1,
  "dialect": "generic",
  "tables": [
    {
      "name": "todos",
      "columns": [
        { "name": "id", "type": "TEXT", "primaryKey": true },
        { "name": "title", "type": "TEXT", "nullable": false },
        { "name": "completed", "type": "INTEGER", "default": 0 },
        { "name": "created_at", "type": "TEXT" }
      ],
      "indexes": [
        { "name": "idx_completed", "columns": ["completed"] }
      ]
    }
  ]
}
```

## Agents: Side-Effect Based Import

Agents are handled differently from Deconfig resources (tools, views, workflows):

**Export:**
- Listed via `AGENTS_LIST` MCP tool
- Each agent fetched individually via `AGENTS_GET` to ensure complete data
- Saved to `agents/{name}.json` files
- Environment-specific fields stripped (id, workspace, project_id, timestamps)

**Import:**
- **NOT** uploaded to Deconfig as files
- Restored via `AGENTS_CREATE` MCP tool (side effect)
- Requires **project workspace context** (not global)
- Each agent recreated with a new ID in destination project

This design treats agents as database-backed entities that happen to be portable via JSON serialization, rather than true Deconfig resources.

## Security & Validation

- All file paths are validated against allowed roots
- **Path mapping**: Local files use clean structure (`/tools`, `/views`, etc.), automatically mapped to Deconfig paths (`/src/tools`, `/src/views`) during import
- Manifest validated with Zod schemas
- JSON files validated before upload
- Binary content detection and rejection
- Slug collision handling with user prompt
- Authentication via existing `deco login` session

## Non-Goals (MVP)

The following are explicitly **NOT** included in this MVP:
- External MCP dependency auto-installation
- Database migration application (schemas saved but not applied)
- UI/web interface (CLI-only)
- Zip file bundling (direct file operations only)
- Git repository import
- Data export/import (schema only, no records)

## Usage Examples

### Export a project
```bash
# Interactive (prompts for org, project, output dir) - PRODUCTION API
deco project export

# Use local development server (http://localhost:3001)
deco project export --local
# or
deco -l project export

# With flags
deco project export --org acme --project todo-app --out ./my-export

# Export without database schemas
deco project export --db-schemas none

# Export all database schemas without selection
deco project export --db-schemas all
```

### Import a project
```bash
# Import from current directory - PRODUCTION API
deco project import

# Use local development server
deco project import --local
# or
deco -l project import --from ./my-export

# Import from specific directory
deco project import --from ./my-export

# Import with overrides
deco project import --from ./my-export --org acme --slug todo-app-v2 --title "Todo App v2"
```

## Testing Checklist

To verify the implementation works:

1. **Export a project:**
   - Run `deco project export`
   - Verify manifest is created
   - Verify all files are present
   - Verify database schemas can be selected

2. **Import the exported project:**
   - Run `deco project import --from <exported-dir>`
   - Verify project is created in destination org
   - Verify all files are uploaded
   - Check project in web UI

3. **Round-trip test:**
   - Export project A
   - Import as project B
   - Export project B
   - Compare exports (should be identical except timestamps/author)

## Files Created/Modified

### New Files
- `packages/sdk/src/mcp/projects/manifest.ts`
- `packages/sdk/src/mcp/projects/db-schemas.ts`
- `packages/cli/src/lib/prompt-project.ts`
- `packages/cli/src/lib/mcp-manifest.ts`
- `packages/cli/src/commands/projects/export.ts`
- `packages/cli/src/commands/projects/import.ts`
- `packages/cli/src/commands/projects/index.ts`

### Modified Files
- `packages/cli/src/commands.ts` (added project command)

## Next Steps (Future Enhancements)

1. Add `--force` flag to export (overwrite non-empty directories)
2. Add agents export/import (when needed)
3. Add external MCP dependency installation during import
4. Add database migration application
5. Add UI for import/export (zip-based)
6. Add Git repository import support
7. Add data export/import (with privacy/security controls)
8. Add export/import of project configuration (themes, settings)

