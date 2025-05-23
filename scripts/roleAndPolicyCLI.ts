#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Role and Policy CLI Tool
 *
 * This CLI tool manages roles, policies, and policy statements for user access control.
 * It interacts with a Supabase database to perform CRUD operations on roles, policies,
 * policy statements, and manage relationships between them.
 *
 * Required environment variables:
 * - SUPABASE_URL: Your Supabase instance URL
 * - SUPABASE_SERVER_TOKEN: Your Supabase service token with adequate permissions
 */

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.31.0";
import { parse } from "https://deno.land/std@0.212.0/flags/mod.ts";
import {
  blue,
  bold,
  green,
  red,
  yellow,
} from "https://deno.land/std@0.212.0/fmt/colors.ts";

// Interfaces for roles, policies, and statements
interface Statement {
  effect: "allow" | "deny";
  resource: string;
}

interface Policy {
  id?: number;
  name: string;
  description?: string | null;
  team_id?: number | null;
  statements: Statement[];
}

interface Role {
  id?: number;
  name: string;
  description?: string | null;
  team_id?: number | null;
}

// Define a custom type for role policies joined with policies
interface RolePolicyWithPolicy {
  policy_id: number;
  policies: {
    id: number;
    name: string;
    description: string | null;
    statements: Statement[];
  };
}

// Define a custom type for policy roles joined with roles
interface PolicyRoleWithRole {
  role_id: number;
  roles: {
    id: number;
    name: string;
    description: string | null;
    team_id: number | null;
  };
}

// CLI configuration
const VERSION = "1.0.0";

// Parse command line arguments
const args = parse(Deno.args, {
  string: [
    "name",
    "description",
    "effect",
    "resource",
    "policy",
    "role",
    "team",
  ],
  boolean: ["help", "version"],
  alias: {
    h: "help",
    v: "version",
    t: "team",
    n: "name",
    d: "description",
    e: "effect",
    r: "resource",
    p: "policy",
    o: "role",
  },
});

// Help text for the CLI
function showHelp() {
  console.log(`
${bold("Role and Policy CLI")} ${VERSION}

${bold("USAGE:")}
  roleAndPolicyCLI.ts <command> [options]

${bold("COMMANDS:")}
  ${blue("role")}
    list                                List all roles
    create                              Create a new role
    update                              Update an existing role
    delete                              Delete a role
    show <role-id>                      Show role details and associated policies

  ${blue("policy")}
    list                                List all policies
    create                              Create a new policy
    update                              Update an existing policy
    delete                              Delete a policy
    show <policy-id>                    Show policy details and statements
    
  ${blue("statement")}
    add                                 Add a statement to a policy
    remove                              Remove a statement from a policy
    list <policy-id>                    List all statements in a policy
    
  ${blue("assignment")}
    assign                              Assign a policy to a role
    unassign                            Unassign a policy from a role
    list-policies <role-id>             List all policies assigned to a role
    list-roles <policy-id>              List all roles assigned to a policy

${bold("OPTIONS:")}
  -h, --help                            Show this help message
  -v, --version                         Show version
  -t, --team <team-id>                  Team ID (for team-specific operations)
  -n, --name <name>                     Name for create/update operations
  -d, --description <description>       Description for create/update operations
  -e, --effect <allow|deny>             Effect for statement operations
  -r, --resource <resource>             Resource pattern for statement operations
  -p, --policy <policy-id>              Policy ID for policy/statement operations
  -o, --role <role-id>                  Role ID for role/assignment operations

${bold("EXAMPLES:")}
  # List all roles
  roleAndPolicyCLI.ts role list
  
  # Create a new role
  roleAndPolicyCLI.ts role create --name "Editor" --description "Can edit content" --team 1
  
  # Create a new policy
  roleAndPolicyCLI.ts policy create --name "Content Editing" --description "Allows content editing"
  
  # Add a statement to a policy
  roleAndPolicyCLI.ts statement add --policy 1 --effect allow --resource "AGENTS_GET"
  
  # Assign a policy to a role
  roleAndPolicyCLI.ts assignment assign --role 1 --policy 2
`);
}

// Main function for the CLI
async function main() {
  // Handle help and version flags
  if (args.help) {
    showHelp();
    Deno.exit(0);
  }

  if (args.version) {
    console.log(`Role and Policy CLI ${VERSION}`);
    Deno.exit(0);
  }

  // Check for required environment variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVER_TOKEN");

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      red(
        "Error: SUPABASE_URL and SUPABASE_SERVER_TOKEN environment variables are required.",
      ),
    );
    Deno.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Process commands
  const [commandGroup, commandAction, ...restArgs] = args._;

  if (typeof commandAction !== "string") {
    console.error(red(`Invalid command action: ${commandAction}`));
    showHelp();
    Deno.exit(1);
  }

  switch (commandGroup) {
    case "role":
      await handleRoleCommand(
        supabase,
        commandAction,
        restArgs.map((arg) => String(arg)),
      );
      break;
    case "policy":
      await handlePolicyCommand(
        supabase,
        commandAction,
        restArgs.map((arg) => String(arg)),
      );
      break;
    case "statement":
      await handleStatementCommand(
        supabase,
        commandAction,
        restArgs.map((arg) => String(arg)),
      );
      break;
    case "assignment":
      await handleAssignmentCommand(
        supabase,
        commandAction,
        restArgs.map((arg) => String(arg)),
      );
      break;
    default:
      console.error(red(`Unknown command group: ${commandGroup}`));
      showHelp();
      Deno.exit(1);
  }
}

/**
 * Handle role-related commands
 */
async function handleRoleCommand(
  supabase: SupabaseClient,
  action: string,
  _restArgs: string[],
) {
  switch (action) {
    case "list":
      await listRoles(supabase);
      break;
    case "create":
      await createRole(supabase);
      break;
    case "update":
      await updateRole(supabase);
      break;
    case "delete":
      await deleteRole(supabase);
      break;
    case "show":
      if (!args.role) {
        console.error(red("Role ID is required for 'show' command"));
        Deno.exit(1);
      }
      await showRole(supabase, parseInt(args.role));
      break;
    default:
      console.error(red(`Unknown role command: ${action}`));
      showHelp();
      Deno.exit(1);
  }
}

/**
 * Handle policy-related commands
 */
async function handlePolicyCommand(
  supabase: SupabaseClient,
  action: string,
  _restArgs: string[],
) {
  switch (action) {
    case "list":
      await listPolicies(supabase);
      break;
    case "create":
      await createPolicy(supabase);
      break;
    case "update":
      await updatePolicy(supabase);
      break;
    case "delete":
      await deletePolicy(supabase);
      break;
    case "show":
      if (!args.policy) {
        console.error(red("Policy ID is required for 'show' command"));
        Deno.exit(1);
      }
      await showPolicy(supabase, parseInt(args.policy));
      break;
    default:
      console.error(red(`Unknown policy command: ${action}`));
      showHelp();
      Deno.exit(1);
  }
}

/**
 * Handle statement-related commands
 */
async function handleStatementCommand(
  supabase: SupabaseClient,
  action: string,
  _restArgs: string[],
) {
  switch (action) {
    case "add":
      await addStatement(supabase);
      break;
    case "remove":
      await removeStatement(supabase);
      break;
    case "list":
      if (!args.policy) {
        console.error(red("Policy ID is required for 'list' command"));
        Deno.exit(1);
      }
      await listStatements(supabase, parseInt(args.policy));
      break;
    default:
      console.error(red(`Unknown statement command: ${action}`));
      showHelp();
      Deno.exit(1);
  }
}

/**
 * Handle assignment-related commands
 */
async function handleAssignmentCommand(
  supabase: SupabaseClient,
  action: string,
  _restArgs: string[],
) {
  switch (action) {
    case "assign":
      await assignPolicyToRole(supabase);
      break;
    case "unassign":
      await unassignPolicyFromRole(supabase);
      break;
    case "list-policies":
      if (!args.role) {
        console.error(red("Role ID is required for 'list-policies' command"));
        Deno.exit(1);
      }
      await listPoliciesForRole(supabase, parseInt(args.role));
      break;
    case "list-roles":
      if (!args.policy) {
        console.error(red("Policy ID is required for 'list-roles' command"));
        Deno.exit(1);
      }
      await listRolesForPolicy(supabase, parseInt(args.policy));
      break;
    default:
      console.error(red(`Unknown assignment command: ${action}`));
      showHelp();
      Deno.exit(1);
  }
}

// ============= ROLE OPERATIONS =============

/**
 * List all roles, optionally filtered by team
 */
async function listRoles(supabase: SupabaseClient) {
  let query = supabase.from("roles").select("id, name, description, team_id");

  const teamId = parseInt(args.team ?? "");
  if (!Number.isNaN(teamId)) {
    query = query.or(`team_id.eq.${teamId},team_id.is.null`);
  } else if (args.team === "null") {
    query = query.or(`team_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error(red("Error listing roles:"), error.message);
    Deno.exit(1);
  }

  if (data.length === 0) {
    console.log(yellow("No roles found."));
    return;
  }

  console.log(bold("\nRoles:"));
  console.log("-------");

  data.forEach((role: Role) => {
    console.log(`${green(`ID: ${role.id}`)}`);
    console.log(`Name: ${role.name}`);
    console.log(`Description: ${role.description || "N/A"}`);
    console.log(`Team ID: ${role.team_id || "Global"}`);
    console.log("-------");
  });
}

/**
 * Create a new role
 */
async function createRole(supabase: SupabaseClient) {
  if (!args.name) {
    console.error(red("Role name is required"));
    Deno.exit(1);
  }

  const role: Role = {
    name: args.name,
    description: args.description || null,
    team_id: args.team ? parseInt(args.team) : null,
  };

  const { data, error } = await supabase.from("roles").insert(role).select();

  if (error) {
    console.error(red("Error creating role:"), error.message);
    Deno.exit(1);
  }

  console.log(green(`Role "${role.name}" created successfully!`));
  console.log(`ID: ${data[0].id}`);
}

/**
 * Update an existing role
 */
async function updateRole(supabase: SupabaseClient) {
  if (!args.role) {
    console.error(red("Role ID is required"));
    Deno.exit(1);
  }

  const roleId = parseInt(args.role);
  const updates: Partial<Role> = {};

  if (args.name) updates.name = args.name;
  if (args.description !== undefined) updates.description = args.description;
  if (args.team) updates.team_id = parseInt(args.team);

  if (Object.keys(updates).length === 0) {
    console.error(
      red("At least one field (name, description, team) must be specified"),
    );
    Deno.exit(1);
  }

  const { data, error } = await supabase
    .from("roles")
    .update(updates)
    .eq("id", roleId)
    .select();

  if (error) {
    console.error(red("Error updating role:"), error.message);
    Deno.exit(1);
  }

  if (data.length === 0) {
    console.error(red(`Role with ID ${roleId} not found`));
    Deno.exit(1);
  }

  console.log(green(`Role with ID ${roleId} updated successfully!`));
}

/**
 * Delete a role
 */
async function deleteRole(supabase: SupabaseClient) {
  if (!args.role) {
    console.error(red("Role ID is required"));
    Deno.exit(1);
  }

  const roleId = parseInt(args.role);

  // First, check if the role exists
  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .single();

  if (roleError) {
    console.error(red("Error finding role:"), roleError.message);
    Deno.exit(1);
  }

  if (!roleData) {
    console.error(red(`Role with ID ${roleId} not found`));
    Deno.exit(1);
  }

  // Check if there are any member_roles associations
  const { count: memberRolesCount, error: countError } = await supabase
    .from("member_roles")
    .select("*", { count: "exact" })
    .eq("role_id", roleId);

  if (countError) {
    console.error(red("Error checking role usage:"), countError.message);
    Deno.exit(1);
  }

  if (memberRolesCount && memberRolesCount > 0) {
    console.error(
      yellow(
        `Warning: Role "${roleData.name}" is assigned to ${memberRolesCount} members`,
      ),
    );

    // Ask for confirmation
    const confirmation = prompt("Do you want to proceed with deletion? (y/N) ");
    if (confirmation?.toLowerCase() !== "y") {
      console.log("Deletion cancelled");
      Deno.exit(0);
    }
  }

  // Delete from role_policies first (foreign key constraint)
  const { error: rolePoliciesError } = await supabase
    .from("role_policies")
    .delete()
    .eq("role_id", roleId);

  if (rolePoliciesError) {
    console.error(
      red("Error removing role policy associations:"),
      rolePoliciesError.message,
    );
    Deno.exit(1);
  }

  // Delete from member_roles
  const { error: memberRolesError } = await supabase
    .from("member_roles")
    .delete()
    .eq("role_id", roleId);

  if (memberRolesError) {
    console.error(
      red("Error removing member role associations:"),
      memberRolesError.message,
    );
    Deno.exit(1);
  }

  // Finally, delete the role
  const { error: deleteError } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId);

  if (deleteError) {
    console.error(red("Error deleting role:"), deleteError.message);
    Deno.exit(1);
  }

  console.log(
    green(`Role "${roleData.name}" (ID: ${roleId}) deleted successfully!`),
  );
}

/**
 * Show role details including associated policies
 */
async function showRole(supabase: SupabaseClient, roleId: number) {
  // Get the role details
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name, description, team_id")
    .eq("id", roleId)
    .single();

  if (roleError) {
    console.error(red("Error fetching role:"), roleError.message);
    Deno.exit(1);
  }

  if (!role) {
    console.error(red(`Role with ID ${roleId} not found`));
    Deno.exit(1);
  }

  // Get policies associated with this role
  const { data: rolePolicies, error: policiesError } = await supabase
    .from("role_policies")
    .select(`
      policy_id,
      policies (id, name, description, statements)
    `)
    .eq("role_id", roleId);

  if (policiesError) {
    console.error(red("Error fetching role policies:"), policiesError.message);
    Deno.exit(1);
  }

  // Display role details
  console.log(bold("\nRole Details:"));
  console.log("------------");
  console.log(`${green(`ID: ${role.id}`)}`);
  console.log(`Name: ${role.name}`);
  console.log(`Description: ${role.description || "N/A"}`);
  console.log(`Team ID: ${role.team_id || "Global"}`);

  // Display associated policies
  console.log(bold("\nAssociated Policies:"));
  console.log("-------------------");

  if (rolePolicies.length === 0) {
    console.log(yellow("No policies associated with this role."));
  } else {
    rolePolicies.forEach((rp: RolePolicyWithPolicy) => {
      const policy = rp.policies;
      console.log(`${green(`Policy ID: ${policy.id}`)}`);
      console.log(`Name: ${policy.name}`);
      console.log(`Description: ${policy.description || "N/A"}`);
      console.log(`Statements Count: ${policy.statements.length}`);
      console.log("-------------------");
    });
  }
}

// ============= POLICY OPERATIONS =============

/**
 * List all policies, optionally filtered by team
 */
async function listPolicies(supabase: SupabaseClient) {
  let query = supabase.from("policies").select(
    "id, name, description, team_id, statements",
  );

  if (args.team) {
    const teamId = parseInt(args.team);
    query = query.or(`team_id.eq.${teamId},team_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error(red("Error listing policies:"), error.message);
    Deno.exit(1);
  }

  if (data.length === 0) {
    console.log(yellow("No policies found."));
    return;
  }

  console.log(bold("\nPolicies:"));
  console.log("---------");

  data.forEach((policy: Policy) => {
    console.log(`${green(`ID: ${policy.id}`)}`);
    console.log(`Name: ${policy.name}`);
    console.log(`Description: ${policy.description || "N/A"}`);
    console.log(`Team ID: ${policy.team_id || "Global"}`);
    console.log(`Statements: ${policy.statements.length}`);
    console.log("---------");
  });
}

/**
 * Create a new policy
 */
async function createPolicy(supabase: SupabaseClient) {
  if (!args.name) {
    console.error(red("Policy name is required"));
    Deno.exit(1);
  }

  const policy: Policy = {
    name: args.name,
    description: args.description || null,
    team_id: args.team ? parseInt(args.team) : null,
    statements: [], // Initial empty statements array
  };

  const { data, error } = await supabase.from("policies").insert(policy)
    .select();

  if (error) {
    console.error(red("Error creating policy:"), error.message);
    Deno.exit(1);
  }

  console.log(green(`Policy "${policy.name}" created successfully!`));
  console.log(`ID: ${data[0].id}`);
}

/**
 * Update an existing policy
 */
async function updatePolicy(supabase: SupabaseClient) {
  if (!args.policy) {
    console.error(red("Policy ID is required"));
    Deno.exit(1);
  }

  const policyId = parseInt(args.policy);
  const updates: Partial<Policy> = {};

  if (args.name) updates.name = args.name;
  if (args.description !== undefined) updates.description = args.description;
  if (args.team) updates.team_id = parseInt(args.team);

  if (Object.keys(updates).length === 0) {
    console.error(
      red("At least one field (name, description, team) must be specified"),
    );
    Deno.exit(1);
  }

  const { data, error } = await supabase
    .from("policies")
    .update(updates)
    .eq("id", policyId)
    .select();

  if (error) {
    console.error(red("Error updating policy:"), error.message);
    Deno.exit(1);
  }

  if (data.length === 0) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  console.log(green(`Policy with ID ${policyId} updated successfully!`));
}

/**
 * Delete a policy
 */
async function deletePolicy(supabase: SupabaseClient) {
  if (!args.policy) {
    console.error(red("Policy ID is required"));
    Deno.exit(1);
  }

  const policyId = parseInt(args.policy);

  // First, check if the policy exists
  const { data: policyData, error: policyError } = await supabase
    .from("policies")
    .select("id, name")
    .eq("id", policyId)
    .single();

  if (policyError) {
    console.error(red("Error finding policy:"), policyError.message);
    Deno.exit(1);
  }

  if (!policyData) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  // Check if there are any role_policies associations
  const { count: rolePoliciesCount, error: countError } = await supabase
    .from("role_policies")
    .select("*", { count: "exact" })
    .eq("policy_id", policyId);

  if (countError) {
    console.error(red("Error checking policy usage:"), countError.message);
    Deno.exit(1);
  }

  if (rolePoliciesCount && rolePoliciesCount > 0) {
    console.error(
      yellow(
        `Warning: Policy "${policyData.name}" is assigned to ${rolePoliciesCount} roles`,
      ),
    );

    // Ask for confirmation
    const confirmation = prompt("Do you want to proceed with deletion? (y/N) ");
    if (confirmation?.toLowerCase() !== "y") {
      console.log("Deletion cancelled");
      Deno.exit(0);
    }
  }

  // Delete from role_policies first (foreign key constraint)
  const { error: rolePoliciesError } = await supabase
    .from("role_policies")
    .delete()
    .eq("policy_id", policyId);

  if (rolePoliciesError) {
    console.error(
      red("Error removing role policy associations:"),
      rolePoliciesError.message,
    );
    Deno.exit(1);
  }

  // Delete the policy
  const { error: deleteError } = await supabase
    .from("policies")
    .delete()
    .eq("id", policyId);

  if (deleteError) {
    console.error(red("Error deleting policy:"), deleteError.message);
    Deno.exit(1);
  }

  console.log(
    green(
      `Policy "${policyData.name}" (ID: ${policyId}) deleted successfully!`,
    ),
  );
}

/**
 * Show policy details including statements
 */
async function showPolicy(supabase: SupabaseClient, policyId: number) {
  // Get the policy details
  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .select("id, name, description, team_id, statements")
    .eq("id", policyId)
    .single();

  if (policyError) {
    console.error(red("Error fetching policy:"), policyError.message);
    Deno.exit(1);
  }

  if (!policy) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  // Display policy details
  console.log(bold("\nPolicy Details:"));
  console.log("--------------");
  console.log(`${green(`ID: ${policy.id}`)}`);
  console.log(`Name: ${policy.name}`);
  console.log(`Description: ${policy.description || "N/A"}`);
  console.log(`Team ID: ${policy.team_id || "Global"}`);

  // Display statements
  console.log(bold("\nStatements:"));
  console.log("-----------");

  if (policy.statements.length === 0) {
    console.log(yellow("No statements defined for this policy."));
  } else {
    policy.statements.forEach((statement: Statement, index: number) => {
      console.log(`${green(`Statement #${index + 1}`)}`);
      console.log(`Effect: ${statement.effect}`);
      console.log(`Resource: ${statement.resource}`);
      console.log("-----------");
    });
  }

  // Get roles that have this policy
  const { data: policyRoles, error: rolesError } = await supabase
    .from("role_policies")
    .select(`
      role_id,
      roles (id, name, description)
    `)
    .eq("policy_id", policyId);

  if (rolesError) {
    console.error(
      red("Error fetching roles with this policy:"),
      rolesError.message,
    );
    Deno.exit(1);
  }

  // Display roles with this policy
  console.log(bold("\nAssigned to Roles:"));
  console.log("-----------------");

  if (policyRoles.length === 0) {
    console.log(yellow("This policy is not assigned to any roles."));
  } else {
    policyRoles.forEach((pr: PolicyRoleWithRole) => {
      const role = pr.roles;
      console.log(`${green(`Role ID: ${role.id}`)}`);
      console.log(`Name: ${role.name}`);
      console.log(`Description: ${role.description || "N/A"}`);
      console.log("-----------------");
    });
  }
}

// ============= STATEMENT OPERATIONS =============

/**
 * Add a statement to a policy
 */
async function addStatement(supabase: SupabaseClient) {
  if (!args.policy) {
    console.error(red("Policy ID is required"));
    Deno.exit(1);
  }

  if (!args.effect || !args.resource) {
    console.error(red("Effect and resource are required for a statement"));
    Deno.exit(1);
  }

  if (args.effect !== "allow" && args.effect !== "deny") {
    console.error(red("Effect must be either 'allow' or 'deny'"));
    Deno.exit(1);
  }

  const policyId = parseInt(args.policy);

  // Get the current policy statements
  const { data: policy, error: getError } = await supabase
    .from("policies")
    .select("statements")
    .eq("id", policyId)
    .single();

  if (getError) {
    console.error(red("Error fetching policy:"), getError.message);
    Deno.exit(1);
  }

  if (!policy) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  // Add the new statement
  const newStatement: Statement = {
    effect: args.effect as "allow" | "deny",
    resource: args.resource,
  };

  const statements = [...policy.statements, newStatement];

  // Update the policy with the new statements array
  const { error: updateError } = await supabase
    .from("policies")
    .update({ statements })
    .eq("id", policyId);

  if (updateError) {
    console.error(red("Error adding statement:"), updateError.message);
    Deno.exit(1);
  }

  console.log(green(`Statement added to policy ID ${policyId} successfully!`));
  console.log(`Effect: ${newStatement.effect}`);
  console.log(`Resource: ${newStatement.resource}`);
}

/**
 * Remove a statement from a policy
 */
async function removeStatement(supabase: SupabaseClient) {
  if (!args.policy) {
    console.error(red("Policy ID is required"));
    Deno.exit(1);
  }

  const policyId = parseInt(args.policy);

  // Get the current policy statements
  const { data: policy, error: getError } = await supabase
    .from("policies")
    .select("statements")
    .eq("id", policyId)
    .single();

  if (getError) {
    console.error(red("Error fetching policy:"), getError.message);
    Deno.exit(1);
  }

  if (!policy) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  if (policy.statements.length === 0) {
    console.error(yellow("This policy has no statements to remove"));
    Deno.exit(0);
  }

  // List all statements for the user to choose
  console.log(bold("Current statements:"));
  policy.statements.forEach((statement: Statement, index: number) => {
    console.log(
      `${green(`[${index + 1}]`)} ${statement.effect} ${statement.resource}`,
    );
  });

  // Ask which statement to remove
  const indexStr = prompt("Enter the number of the statement to remove: ");
  if (!indexStr) {
    console.log("Operation cancelled");
    Deno.exit(0);
  }

  const index = parseInt(indexStr) - 1; // Convert to 0-based index

  if (isNaN(index) || index < 0 || index >= policy.statements.length) {
    console.error(red("Invalid statement number"));
    Deno.exit(1);
  }

  // Remove the statement
  const statements = [...policy.statements];
  const removed = statements.splice(index, 1)[0];

  // Update the policy
  const { error: updateError } = await supabase
    .from("policies")
    .update({ statements })
    .eq("id", policyId);

  if (updateError) {
    console.error(red("Error removing statement:"), updateError.message);
    Deno.exit(1);
  }

  console.log(
    green(`Statement removed from policy ID ${policyId} successfully!`),
  );
  console.log(`Removed: ${removed.effect} ${removed.resource}`);
}

/**
 * List all statements in a policy
 */
async function listStatements(supabase: SupabaseClient, policyId: number) {
  // Get the policy with statements
  const { data: policy, error } = await supabase
    .from("policies")
    .select("id, name, statements")
    .eq("id", policyId)
    .single();

  if (error) {
    console.error(red("Error fetching policy:"), error.message);
    Deno.exit(1);
  }

  if (!policy) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  console.log(
    bold(`\nStatements for Policy "${policy.name}" (ID: ${policy.id}):`),
  );
  console.log("----------------------------------------------------");

  if (policy.statements.length === 0) {
    console.log(yellow("No statements defined for this policy."));
    return;
  }

  policy.statements.forEach((statement: Statement, index: number) => {
    console.log(`${green(`Statement #${index + 1}`)}`);
    console.log(`Effect: ${statement.effect}`);
    console.log(`Resource: ${statement.resource}`);
    console.log("--------------------");
  });
}

// ============= ASSIGNMENT OPERATIONS =============

/**
 * Assign a policy to a role
 */
async function assignPolicyToRole(supabase: SupabaseClient) {
  if (!args.role || !args.policy) {
    console.error(red("Role ID and Policy ID are required"));
    Deno.exit(1);
  }

  const roleId = parseInt(args.role);
  const policyId = parseInt(args.policy);

  // Check if role exists
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .single();

  if (roleError || !role) {
    console.error(red(`Role with ID ${roleId} not found`));
    Deno.exit(1);
  }

  // Check if policy exists
  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .select("id, name")
    .eq("id", policyId)
    .single();

  if (policyError || !policy) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  // Check if assignment already exists
  const { data: existing, error: existingError } = await supabase
    .from("role_policies")
    .select("id")
    .eq("role_id", roleId)
    .eq("policy_id", policyId);

  if (existingError) {
    console.error(
      red("Error checking existing assignment:"),
      existingError.message,
    );
    Deno.exit(1);
  }

  if (existing && existing.length > 0) {
    console.log(
      yellow(
        `Policy "${policy.name}" is already assigned to role "${role.name}"`,
      ),
    );
    Deno.exit(0);
  }

  // Create the assignment
  const { error: insertError } = await supabase
    .from("role_policies")
    .insert({
      role_id: roleId,
      policy_id: policyId,
    });

  if (insertError) {
    console.error(red("Error assigning policy to role:"), insertError.message);
    Deno.exit(1);
  }

  console.log(
    green(
      `Policy "${policy.name}" assigned to role "${role.name}" successfully!`,
    ),
  );
}

/**
 * Unassign a policy from a role
 */
async function unassignPolicyFromRole(supabase: SupabaseClient) {
  if (!args.role || !args.policy) {
    console.error(red("Role ID and Policy ID are required"));
    Deno.exit(1);
  }

  const roleId = parseInt(args.role);
  const policyId = parseInt(args.policy);

  // Check if assignment exists
  const { data: existing, error: existingError } = await supabase
    .from("role_policies")
    .select(`
      id,
      roles (name),
      policies (name)
    `)
    .eq("role_id", roleId)
    .eq("policy_id", policyId)
    .single();

  if (existingError && existingError.code !== "PGRST116") { // Not found error
    console.error(red("Error checking assignment:"), existingError.message);
    Deno.exit(1);
  }

  if (!existing) {
    console.error(
      yellow(
        `Policy with ID ${policyId} is not assigned to role with ID ${roleId}`,
      ),
    );
    Deno.exit(0);
  }

  // Delete the assignment
  const { error: deleteError } = await supabase
    .from("role_policies")
    .delete()
    .eq("role_id", roleId)
    .eq("policy_id", policyId);

  if (deleteError) {
    console.error(
      red("Error unassigning policy from role:"),
      deleteError.message,
    );
    Deno.exit(1);
  }

  console.log(
    green(
      `Policy "${existing.policies.name}" unassigned from role "${existing.roles.name}" successfully!`,
    ),
  );
}

/**
 * List all policies assigned to a role
 */
async function listPoliciesForRole(supabase: SupabaseClient, roleId: number) {
  const { data: rolePolicies, error } = await supabase
    .from("role_policies")
    .select(`
      policy_id,
      policies (id, name, description, statements)
    `)
    .eq("role_id", roleId);

  if (error) {
    console.error(red("Error fetching policies:"), error.message);
    Deno.exit(1);
  }

  // Check if role exists
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .single();

  if (roleError || !role) {
    console.error(red(`Role with ID ${roleId} not found`));
    Deno.exit(1);
  }

  console.log(
    bold(`\nPolicies assigned to Role "${role.name}" (ID: ${role.id}):`),
  );
  console.log("-----------------------------------------------");

  if (rolePolicies.length === 0) {
    console.log(yellow("No policies assigned to this role."));
    return;
  }

  rolePolicies.forEach((rp: RolePolicyWithPolicy) => {
    const policy = rp.policies;
    console.log(`${green(`Policy ID: ${policy.id}`)}`);
    console.log(`Name: ${policy.name}`);
    console.log(`Description: ${policy.description || "N/A"}`);
    console.log(`Statements: ${policy.statements.length}`);
    console.log("-------------------");
  });
}

/**
 * List all roles assigned to a policy
 */
async function listRolesForPolicy(supabase: SupabaseClient, policyId: number) {
  // Get policy name first
  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .select("id, name")
    .eq("id", policyId)
    .single();

  if (policyError || !policy) {
    console.error(red(`Policy with ID ${policyId} not found`));
    Deno.exit(1);
  }

  // Get all roles for this policy
  const { data: policyRoles, error: rolesError } = await supabase
    .from("role_policies")
    .select(`
      role_id,
      roles (id, name, description, team_id)
    `)
    .eq("policy_id", policyId);

  if (rolesError) {
    console.error(red("Error fetching roles:"), rolesError.message);
    Deno.exit(1);
  }

  console.log(bold(`\nRoles with Policy "${policy.name}" (ID: ${policy.id}):`));
  console.log("-----------------------------------------------");

  if (policyRoles.length === 0) {
    console.log(yellow("This policy is not assigned to any roles."));
    return;
  }

  policyRoles.forEach((pr: PolicyRoleWithRole) => {
    const role = pr.roles;
    console.log(`${green(`Role ID: ${role.id}`)}`);
    console.log(`Name: ${role.name}`);
    console.log(`Description: ${role.description || "N/A"}`);
    console.log(`Team ID: ${role.team_id || "Global"}`);
    console.log("-------------------");
  });
}

// Execute the main function
if (import.meta.main) {
  await main();
}
