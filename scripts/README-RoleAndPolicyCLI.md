# Role and Policy CLI Tool

This CLI tool manages roles, policies, and policy statements for user access
control in the Deco Chat application. It interacts with a Supabase database to
perform CRUD operations on roles, policies, policy statements, and manage
relationships between them.

## Prerequisites

- [Deno](https://deno.land/) installed
- Supabase credentials (URL and server token)

## Environment Setup

Before using the CLI, you need to set the following environment variables:

```bash
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVER_TOKEN="your_supabase_service_token"
```

## Usage

The CLI provides commands for managing roles, policies, statements, and their
relationships.

### General Format

```bash
deno run --allow-env --allow-net scripts/roleAndPolicyCLI.ts <command> [options]
```

Alternatively, you can make the script executable and run it directly:

```bash
chmod +x scripts/roleAndPolicyCLI.ts
./scripts/roleAndPolicyCLI.ts <command> [options]
```

### Help and Version

```bash
# Show help
./scripts/roleAndPolicyCLI.ts --help

# Show version
./scripts/roleAndPolicyCLI.ts --version
```

### Role Management

```bash
# List all roles
./scripts/roleAndPolicyCLI.ts role list

# List roles filtered by team
./scripts/roleAndPolicyCLI.ts role list --team 1

# Create a new role
./scripts/roleAndPolicyCLI.ts role create --name "Editor" --description "Can edit content" --team 1

# Update a role
./scripts/roleAndPolicyCLI.ts role update --role 1 --name "Senior Editor" --description "Can edit and publish content"

# Delete a role
./scripts/roleAndPolicyCLI.ts role delete --role 1

# Show role details and associated policies
./scripts/roleAndPolicyCLI.ts role show --role 1
```

### Policy Management

```bash
# List all policies
./scripts/roleAndPolicyCLI.ts policy list

# List policies filtered by team
./scripts/roleAndPolicyCLI.ts policy list --team 1

# Create a new policy
./scripts/roleAndPolicyCLI.ts policy create --name "Content Editing" --description "Allows content editing" --team 1

# Update a policy
./scripts/roleAndPolicyCLI.ts policy update --policy 1 --name "Advanced Content Editing" --description "Allows advanced content editing"

# Delete a policy
./scripts/roleAndPolicyCLI.ts policy delete --policy 1

# Show policy details and statements
./scripts/roleAndPolicyCLI.ts policy show --policy 1
```

### Statement Management

```bash
# Add a statement to a policy
./scripts/roleAndPolicyCLI.ts statement add --policy 1 --effect allow --resource "pages:*"

# List all statements in a policy
./scripts/roleAndPolicyCLI.ts statement list --policy 1

# Remove a statement from a policy (interactive)
./scripts/roleAndPolicyCLI.ts statement remove --policy 1
```

### Role-Policy Assignment Management

```bash
# Assign a policy to a role
./scripts/roleAndPolicyCLI.ts assignment assign --role 1 --policy 2

# Unassign a policy from a role
./scripts/roleAndPolicyCLI.ts assignment unassign --role 1 --policy 2

# List all policies assigned to a role
./scripts/roleAndPolicyCLI.ts assignment list-policies --role 1

# List all roles assigned to a policy
./scripts/roleAndPolicyCLI.ts assignment list-roles --policy 1
```

## Examples

### Creating a Complete Role with Policies

```bash
# Create a new role
./scripts/roleAndPolicyCLI.ts role create --name "Content Manager" --description "Manages all content"

# Create a new policy
./scripts/roleAndPolicyCLI.ts policy create --name "Content Management" --description "Allows content management"

# Add statements to the policy
./scripts/roleAndPolicyCLI.ts statement add --policy 1 --effect allow --resource "pages:read:*"
./scripts/roleAndPolicyCLI.ts statement add --policy 1 --effect allow --resource "pages:write:*"
./scripts/roleAndPolicyCLI.ts statement add --policy 1 --effect deny --resource "pages:delete:*"

# Assign the policy to the role
./scripts/roleAndPolicyCLI.ts assignment assign --role 1 --policy 1

# Verify the setup
./scripts/roleAndPolicyCLI.ts role show --role 1
```

## Error Handling

The CLI provides descriptive error messages when operations fail. It also asks
for confirmation before potentially destructive operations like deleting roles
or policies that are in use.
