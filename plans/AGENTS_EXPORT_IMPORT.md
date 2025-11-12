# Agents Export/Import Feature

## Overview

Added support for exporting and importing agents as part of the project export/import CLI flow. Agents are treated as pseudo-resources that serialize to JSON files and restore via MCP tool calls.

## Implementation Details

### Export Flow

1. **List agents**: Uses `AGENTS_LIST` tool to get agent IDs and names
2. **Fetch full details**: For each agent, calls `AGENTS_GET` to retrieve complete configuration (instructions, tools_set, memory, views, etc.)
3. **Strip environment-specific fields**: Removes `id`, `workspace`, `project_id`, `created_at`, and `access_id`
4. **Save to `agents/` directory**: Each agent is saved as `agents/{agent-name}.json` with a sanitized filename
5. **Track count**: Displays count in final summary with progress indicators

**Fields exported**:
- `name` - Agent name
- `avatar` - Avatar URL
- `instructions` - System prompt
- `description` - Optional description
- `tools_set` - Tools available to agent (integrationId → tool names)
- `max_steps` - Optional max steps
- `max_tokens` - Optional max tokens
- `model` - Model ID
- `memory` - Optional memory config
- `views` - View configurations
- `visibility` - Visibility level
- `temperature` - Optional temperature

### Import Flow

1. **Check for `agents/` directory**: Looks for agent JSON files in source directory
2. **Connect to project workspace**: Switches from global client to project workspace context
3. **Call `AGENTS_CREATE` for each agent**: Restores agents via MCP tool
4. **Track results**: Reports successes and failures
5. **Close project client**: Cleans up connection

**Key differences from Deconfig resources**:
- Agents are **NOT** stored in Deconfig (no `PUT_FILE` calls)
- Agents are created via `AGENTS_CREATE` MCP tool
- Requires project workspace context (not global context)
- Side-effect-based restoration instead of file upload

## File Structure

```
exported-project/
├── deco.mcp.json
├── agents/
│   ├── customer-support-agent.json
│   ├── data-analyst.json
│   └── code-review-bot.json
├── tools/
│   └── *.json
├── views/
│   └── *.json
├── workflows/
│   └── *.json
└── documents/
    └── *.json
```

**Note:** Exported files are saved at the root level (no `src/` prefix) for cleaner structure. During import, the CLI automatically adds the `/src/` prefix when uploading to Deconfig.

## Usage

### Export
```bash
deco project export --local
# Output includes:
# 👤 Fetching agents...
#    Found 3 agents
#    Exported 5/10 agents...  # Progress every 5 agents
#    ✅ Exported 3 agents
#
# 📊 Summary:
#    Agents: 3
```

### Import
```bash
deco project import my-project/
# Output includes:
# 👤 Importing agents...
#    Found 3 agent files
#    ✅ Imported 3 agents
#
# 📊 Summary:
#    Agents created: 3
```

## Technical Notes

### Filename Sanitization
Agent names are converted to safe filenames:
- Lowercase
- Non-alphanumeric characters replaced with `-`
- Leading/trailing dashes removed
- Examples:
  - "Customer Support Agent" → `customer-support-agent.json`
  - "Data Analyst 2.0!" → `data-analyst-2-0.json`

### Error Handling
- Export: 
  - Warns if `AGENTS_LIST` fails but continues
  - Logs individual `AGENTS_GET` failures but continues with remaining agents
  - Progress indicators every 5 agents
- Import: 
  - Logs individual agent failures but continues with remaining agents
  - Progress indicators every 5 agents

### Context Management
Import requires careful client management:
1. Global client for project creation
2. **Project workspace client for agent creation** (critical!)
3. Proper cleanup with `finally` blocks

## Future Enhancements

- [ ] Support for agent-specific access rules
- [ ] Validation of tool references in `tools_set`
- [ ] Dry-run mode to preview agents before import
- [ ] Conflict resolution for duplicate agent names
- [ ] Agent versioning and updates

## Related Files

- `packages/cli/src/commands/projects/export.ts` - Export implementation
- `packages/cli/src/commands/projects/import.ts` - Import implementation
- `packages/sdk/src/mcp/agents/api.ts` - MCP agent tools
- `packages/sdk/src/models/agent.ts` - Agent schema

