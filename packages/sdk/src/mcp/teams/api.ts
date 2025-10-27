import { z } from "zod";
import {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import type { Json } from "../../storage/index.ts";
import type { Theme } from "../../theme.ts";
import {
  assertHasWorkspace,
  assertPrincipalIsUser,
  assertTeamResourceAccess,
} from "../assertions.ts";
import { type AppContext, resourceGroupMap } from "../context.ts";
import {
  getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION,
  getWorkspaceBucketName,
} from "../fs/api.ts";
import { createTool } from "../members/api.ts";
import { mergeThemes } from "./merge-theme.ts";
import { getWalletClient } from "../wallet/api.ts";
import { getTeamBySlug } from "../members/invites-utils.ts";
import {
  isValidMonth,
  isValidYear,
  WellKnownTransactions,
} from "../wallet/well-known.ts";
import { MicroDollar, type Transaction } from "../wallet/index.ts";
import { WebCache } from "../../cache/index.ts";
import { TeamWithViews } from "../../crud/teams.ts";
import { type View } from "../../views.ts";
import { RoleUpdateAction } from "../../auth/policy.ts";
import { Statement } from "../../models/index.ts";
import { isRequired } from "../../utils/fns.ts";
import { parseId } from "../integrations/api.ts";
import { eq, inArray, and, isNull } from "drizzle-orm";
import {
  members as membersTable,
  memberRoles as memberRolesTable,
  organizations,
  projects,
} from "../schema.ts";
import { enhancedThemeSchema } from "../theme/api.ts";

const OWNER_ROLE_ID = 1;

const ToolPermissionSchema = z.object({
  toolName: z.string(),
  effect: z.enum(["allow", "deny"]),
  policyId: z.string().optional(),
});

const ToolsSchema = z.record(z.string(), z.array(ToolPermissionSchema));

const MemberRoleActionSchema = z.object({
  user_id: z.string(),
  action: RoleUpdateAction,
});

const RoleFormDataSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  tools: ToolsSchema,
  agents: z.array(z.string()).optional().default([]),
  members: z
    .array(MemberRoleActionSchema)
    .optional()
    .default([])
    .describe(
      `Only send member actions for changes (diff between original and current state)
    Members who already have the role and remain selected: no action needed (maintains access)
    Members who don't have the role and remain unselected: no action needed (maintains no access)`,
    ),
});

export type MemberRoleAction = z.infer<typeof MemberRoleActionSchema>;
export type RoleFormData = z.infer<typeof RoleFormDataSchema>;
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;
type ToolsMap = z.infer<typeof ToolsSchema>;

export const sanitizeTeamName = (name: string): string => {
  if (!name) return "";
  const nameWithoutAccents = removeNameAccents(name);
  return nameWithoutAccents
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-.+@]/g, "");
};

export const getAvatarFromTheme = (
  theme: Json,
  createSignedUrl: (path: string) => Promise<string>,
): Promise<string | undefined> => {
  if (
    theme !== null &&
    typeof theme === "object" &&
    "picture" in theme &&
    typeof theme.picture === "string"
  ) {
    const picture = theme.picture as string;
    return createSignedUrl(picture).catch((error) => {
      console.error("Error getting avatar from theme", error);
      return undefined;
    });
  }
  return Promise.resolve(undefined);
};

export const removeNameAccents = (name: string): string => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const buildSignedUrlCreator = ({
  c,
  existingBucketName,
}: {
  c: AppContext;
  existingBucketName: string;
}) => {
  return (path: string) => {
    // Team avatars are ok to be public
    return getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION({
      c,
      path,
      existingBucketName,
      expiresIn: 180,
    });
  };
};

const cache = new WebCache<string>("monthly-plan-credits-reward");
const TWELVE_HOURS_IN_SECONDS = 12 * 60 * 60;

const ensureMonthlyPlanCreditsReward = async ({
  slug,
  workspace,
  context: c,
}: {
  slug: string;
  workspace: string;
  context: AppContext;
}) => {
  const month = String(new Date().getMonth() + 1);
  const year = String(new Date().getFullYear());

  if (!isValidMonth(month) || !isValidYear(year)) {
    throw new Error("Invalid month or year");
  }

  const cacheKey = `${slug}-${month}-${year}`;

  if (await cache.has(cacheKey)) {
    return;
  }

  const wallet = getWalletClient(c);
  const team = await getTeamBySlug(slug, c.db);
  const monthlyReward = team.plan.monthly_credit_in_dollars;
  const monthlyRewardMicroDollars = MicroDollar.fromDollars(monthlyReward);

  const transactionId = WellKnownTransactions.monthlyPlanCreditsReward(
    encodeURIComponent(workspace),
    month,
    year,
  );

  const transaction: Transaction = {
    type: "WorkspaceGenCreditReward",
    amount: monthlyRewardMicroDollars.toMicrodollarString(),
    workspace,
    timestamp: new Date(),
  };

  const response = await wallet["PUT /transactions/:id"](
    {
      id: transactionId,
    },
    {
      body: transaction,
    },
  );

  if (response.status !== 200 && response.status !== 304) {
    return console.error(
      `Failed to claim Team monthly plan credits reward for team ${workspace}`,
      response,
      await response.text(),
    );
  }

  await cache.set(cacheKey, transactionId, { ttl: TWELVE_HOURS_IN_SECONDS });
};

const getIntegrationIdForGroup = (wellKnownGroup?: string) => {
  return wellKnownGroup ? `i:${wellKnownGroup}` : "";
};

const getMatchConditionForTool = (
  tool: ToolPermission,
  integrationId: string,
): Pick<Statement, "matchCondition"> => {
  const resourceGroup = resourceGroupMap.get(tool.toolName);

  // if tool is well known, doesn't add the integrationId to the matchCondition
  if (
    resourceGroup &&
    integrationId === getIntegrationIdForGroup(resourceGroup)
  ) {
    return {};
  }

  return {
    matchCondition: {
      resource: "is_integration",
      integrationId,
    },
  };
};

const mapToolsToStatements = (tools: ToolsMap) =>
  Object.entries(tools || {})
    .map(([integrationId, toolPermissions]) => {
      if (toolPermissions.length === 0) return null;

      const statements = toolPermissions.map(
        (tool): Statement => ({
          effect: tool.effect,
          resource: tool.toolName,
          ...getMatchConditionForTool(tool, integrationId),
        }),
      );

      return statements;
    })
    .filter(isRequired)
    .flat();

/**
 * Helper function to assign roles to members
 * Handles the common pattern of fetching member profiles and updating their roles
 */
async function assignRoleToMembers(
  c: AppContext,
  teamId: number,
  roleId: number,
  members: MemberRoleAction[],
) {
  if (!members || members.length === 0) {
    return;
  }

  // Assign role to specified members
  const { data: dbMembers } = await c.db
    .from("members")
    .select("profiles(email), user_id")
    .eq("team_id", teamId)
    .in(
      "user_id",
      members.map((m) => m.user_id),
    );

  const memberRolePromises =
    dbMembers?.map(
      async (member: {
        profiles: { email: string } | null;
        user_id: string | null;
      }) => {
        const action = members.find(
          (m) => m.user_id === member.user_id,
        )?.action;
        if (!member.profiles?.email || !action) return;

        return await c.policy.updateUserRole(teamId, member.profiles.email, {
          roleId,
          action,
        });
      },
    ) ?? [];

  await Promise.all(memberRolePromises);
}

export const getTeam = createTool({
  name: "TEAMS_GET",
  description: "Get a team by slug",
  inputSchema: z.lazy(() =>
    z.object({
      slug: z.string(),
    }),
  ),
  handler: async (props, c) => {
    const { slug } = props;

    await assertTeamResourceAccess(c.tool.name, slug, c);

    const { data: teamData, error } = await c.db
      .from("teams")
      .select(`
        *,
        deco_chat_views (
          id,
          title,
          icon,
          type,
          metadata,
          integration_id,
          name
        )
      `)
      .eq("slug", slug)
      .single();

    if (error) throw error;
    if (!teamData) {
      throw new NotFoundError("Team not found or user does not have access");
    }

    await ensureMonthlyPlanCreditsReward({
      slug,
      workspace: `/shared/${slug}`,
      context: c,
    });

    const rawViews =
      (teamData.deco_chat_views as unknown as Array<{
        id: string;
        title: string;
        icon: string;
        type: string;
        metadata?: {
          integration?: { id?: string };
          viewName?: string;
          resourceType?: string;
        } | null;
        integration_id?: string | null;
        name?: string | null;
      }>) || [];

    // Separate views and resources based on type
    const views = rawViews.filter((v) => v.type !== "resource");
    const resources = rawViews.filter((v) => v.type === "resource");

    const mappedViews = views.map((v) => ({
      ...v,
      // New columns with backward-compat
      integrationId: v.integration_id ?? v.metadata?.integration?.id,
      name: v.name ?? v.metadata?.viewName,
    }));

    const mappedResources = resources.map((r) => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      type: r.type as "resource",
      name: r.name ?? r.metadata?.viewName ?? "",
      resource_type: r.metadata?.resourceType ?? "unknown",
      integration_id: r.integration_id ?? r.metadata?.integration?.id ?? "",
      created_at: new Date().toISOString(), // We don't have this in views table
      updated_at: new Date().toISOString(), // We don't have this in views table
    }));

    const teamWithoutAvatar: Omit<TeamWithViews, "avatar_url"> = {
      id: teamData.id,
      name: teamData.name,
      slug,
      theme: teamData.theme as Theme,
      created_at: teamData.created_at as string,
      views: (mappedViews as View[]) || [],
      resources: mappedResources || [],
    };

    try {
      const signedUrlCreator = buildSignedUrlCreator({
        c,
        existingBucketName: getWorkspaceBucketName(`/shared/${slug}`),
      });
      return {
        ...teamWithoutAvatar,
        avatar_url: await getAvatarFromTheme(teamData.theme, signedUrlCreator),
      };
    } catch (error) {
      console.error("Error getting signed url creator", error);
      return {
        ...teamWithoutAvatar,
        avatar_url: null,
      };
    }
  },
});

export const createTeam = createTool({
  name: "TEAMS_CREATE",
  description: "Create a new team",
  inputSchema: z.lazy(() =>
    z.object({
      name: z.string(),
      slug: z.string(),
    }),
  ),

  /**
   * This function handle this steps:
   * 1. check if team slug already exists;
   * 2. If team slug is free ok, procceed, and create team
   * 3. Add user that made the request as team member of team with activity
   * 4. Add member role as onwer (id: 1).
   */
  handler: async (props, c) => {
    c.resourceAccess.grant();

    assertPrincipalIsUser(c);
    const { name, slug } = props;
    const user = c.user;

    // Enforce unique slug if provided
    if (slug) {
      const { data: existingTeam, error: slugError } = await c.db
        .from("teams")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new UserInputError("A team with this slug already exists.");
      }
    }

    // Create the team
    const { data: team, error: createError } = await c.db
      .from("teams")
      .insert([{ name: sanitizeTeamName(name), slug }])
      .select()
      .single();

    if (createError) throw createError;

    // Add the creator as an admin member
    const { data: member, error: memberError } = await c.db
      .from("members")
      .insert([
        {
          team_id: team.id,
          user_id: user.id,
          activity: [
            {
              action: "add_member",
              timestamp: new Date().toISOString(),
            },
          ],
        },
      ])
      .select()
      .single();

    if (memberError) {
      await c.db.from("teams").delete().eq("id", team.id);
      throw memberError;
    }

    // Set the member's role_id to 1 in member_roles
    const { error: roleError } = await c.db.from("member_roles").insert([
      {
        member_id: member.id,
        role_id: OWNER_ROLE_ID,
      },
    ]);

    if (roleError) throw roleError;

    // Insert default project
    const { error: projectError } = await c.db
      .from("deco_chat_projects")
      .insert([
        {
          org_id: team.id,
          slug: "default",
          title: `${team.name} Default project`,
          description: `${team.name}'s Default project`,
        },
      ]);

    if (projectError) throw projectError;

    return team;
  },
});

export const updateTeam = createTool({
  name: "TEAMS_UPDATE",
  description: "Update an existing team including theme customization",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.number().describe("The id of the team to update"),
      data: z.object({
        name: z.string().optional().describe("Team name"),
        slug: z.string().optional().describe("Team URL slug"),
        theme: enhancedThemeSchema.optional(),
      }),
    }),
  ),
  handler: async (props, c) => {
    const { id, data } = props;

    await assertTeamResourceAccess(c.tool.name, id, c);

    // TODO: check if it's required
    // Enforce unique slug if being updated
    if (data.slug) {
      const { data: existingTeam, error: slugError } = await c.db
        .from("teams")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", id)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new UserInputError("A team with this slug already exists.");
      }
    }

    // Get current team data to merge theme
    const { data: currentTeam, error: getError } = await c.db
      .from("teams")
      .select("theme")
      .eq("id", id)
      .single();

    if (getError) throw getError;

    const mergedTheme = mergeThemes(currentTeam.theme, data.theme);

    // Update the team
    const { data: updatedTeam, error: updateError } = await c.db
      .from("teams")
      .update({
        ...data,
        ...(data.name ? { name: sanitizeTeamName(data.name) } : {}),
        ...(mergedTheme ? { theme: mergedTheme as Json } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    const signedUrlCreator = buildSignedUrlCreator({
      c,
      existingBucketName: getWorkspaceBucketName(`/shared/${updatedTeam.slug}`),
    });

    return {
      ...updatedTeam,
      avatar_url: await getAvatarFromTheme(updatedTeam.theme, signedUrlCreator),
    };
  },
});

export const deleteTeam = createTool({
  name: "TEAMS_DELETE",
  description: "Delete a team by id",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      success: z.boolean(),
      error: z.string().optional(),
    }),
  ),
  handler: async (props, c) => {
    const { teamId } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    try {
      await c.drizzle.transaction(async (tx) => {
        const memberIds = await tx
          .select({ id: membersTable.id })
          .from(membersTable)
          .where(eq(membersTable.team_id, teamId))
          .then((r) => r.map((m) => m.id));

        if (!memberIds) {
          throw new InternalServerError("No members found");
        }

        await tx
          .delete(memberRolesTable)
          .where(inArray(memberRolesTable.member_id, memberIds));
        await tx.delete(membersTable).where(eq(membersTable.team_id, teamId));

        await tx.delete(organizations).where(eq(organizations.id, teamId));
      });
    } catch (error) {
      console.error("Error deleting team", error);

      let message = error instanceof Error ? error.message : "Unknown error";
      if (
        error instanceof Error &&
        error.cause instanceof Error &&
        "constraint_name" in error.cause
      ) {
        if (error.cause.constraint_name === "deco_chat_projects_org_id_fkey") {
          message =
            "Cannot delete team with existing projects. Please delete the projects first.";
        }
      }

      return {
        success: false,
        error: message,
      };
    }

    return { success: true };
  },
});

export const listTeams = createTool({
  name: "TEAMS_LIST",
  description: "List teams for the current user",
  inputSchema: z.lazy(() => z.object({})),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(z.any()),
    }),
  ),
  handler: async (_, c) => {
    c.resourceAccess.grant();

    assertPrincipalIsUser(c);
    const user = c.user;

    const { data, error } = await c.db
      .from("teams")
      .select(`
        id,
        name,
        slug,
        theme,
        created_at,
        members!inner (
          id,
          user_id,
          admin
        )
      `)
      .not("slug", "is", null)
      .eq("members.user_id", user.id)
      .is("members.deleted_at", null);

    if (error) {
      console.error(error);
      throw error;
    }

    const teamsWithoutAvatar = data.map(
      ({ members: _members, ...teamData }) => teamData,
    );

    const teamsWithAvatar = await Promise.all(
      teamsWithoutAvatar.map(async (team) => {
        const signedUrlCreator = buildSignedUrlCreator({
          c,
          existingBucketName: getWorkspaceBucketName(`/shared/${team.slug}`),
        });
        return {
          ...team,
          avatar_url: await getAvatarFromTheme(team.theme, signedUrlCreator),
        };
      }),
    );

    return { items: teamsWithAvatar };
  },
});

export const getOrgTheme = createTool({
  name: "GET_ORG_THEME",
  description: "Get the theme for an organization",
  inputSchema: z.lazy(() =>
    z.object({
      slug: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      theme: enhancedThemeSchema.nullable(),
    }),
  ),
  handler: async (props, c) => {
    c.resourceAccess.grant();
    const { slug } = props;

    const { data: team, error } = await c.db
      .from("teams")
      .select("theme")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;

    const _theme = team?.theme as Theme | null;

    if (!_theme || typeof _theme !== "object") {
      return { theme: {} };
    }

    const signedUrlCreator = buildSignedUrlCreator({
      c,
      existingBucketName: getWorkspaceBucketName(`/shared/${slug}`),
    });

    const theme = {
      ..._theme,
      picture: _theme?.picture
        ? await getAvatarFromTheme(_theme as Json, signedUrlCreator)
        : undefined,
    };
    return { theme };
  },
});

export const createTeamRole = createTool({
  name: "TEAM_ROLE_CREATE",
  description:
    "Create a new team role with associated policies and permissions",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      roleData: RoleFormDataSchema,
    }),
  ),
  handler: async (props, c) => {
    const { teamId, roleData } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    const { name, description, tools, agents, members } = roleData;

    try {
      const inlineStatements = mapToolsToStatements(tools);

      const newRole = {
        name,
        description: description ?? null,
      };
      const role = await c.policy.createRole(teamId, newRole, inlineStatements);

      if (members && members.length > 0) {
        await assignRoleToMembers(c, teamId, role.id, members);
      }

      // if (agents && agents.length > 0) {
      // Assign role to specified agents
      //     const agentRolePromises = agents.map(async (agentId) => {
      //         return await c.policy.updateUserRole(teamId, agentId, {
      //             roleId: role.id,
      //             action: "grant",
      //         });
      //     });

      //     await Promise.all(agentRolePromises);
      // }

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        team_id: role.team_id,
        tools: tools || {},
        agents: agents || [],
        members: members || [],
      };
    } catch (error) {
      console.error("Error creating team role:", error);
      throw new InternalServerError("Failed to create team role");
    }
  },
});

export const deleteTeamRole = createTool({
  name: "TEAM_ROLE_DELETE",
  description:
    "Delete a team role and its associated policies (only team-specific roles)",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      roleId: z.number(),
    }),
  ),
  handler: async (props, c) => {
    const { teamId, roleId } = props;

    if (teamId === null) {
      throw new UserInputError("Team ID is required");
    }

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    try {
      await c.policy.deleteRole(teamId, roleId);

      return { success: true, deletedRoleId: roleId };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot delete system roles")
      ) {
        throw new UserInputError(
          "Cannot delete system roles. Only team-specific roles can be deleted.",
        );
      }
      console.error("Error deleting team role:", error);
      throw new InternalServerError("Failed to delete team role");
    }
  },
});

export const updateTeamRole = createTool({
  name: "TEAM_ROLE_UPDATE",
  description: "Update a team role and its associated policies",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      roleId: z.number(),
      roleData: RoleFormDataSchema,
    }),
  ),
  handler: async (props, c) => {
    const { teamId, roleId, roleData } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    const { name, description, tools, agents, members } = roleData;

    try {
      const inlineStatements = mapToolsToStatements(tools);

      // Update the role using PolicyClient
      const updatedRole = await c.policy.updateRole(
        teamId,
        {
          id: roleId,
          name,
          description: description || null,
        },
        inlineStatements,
      );

      if (!updatedRole) {
        throw new InternalServerError("Failed to update role");
      }

      if (members && members.length > 0) {
        await assignRoleToMembers(c, teamId, updatedRole.id, members);
      }

      // TODO: update agents roles

      return {
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        team_id: updatedRole.team_id,
        tools: tools || {},
        agents: agents || [],
        members: members || [],
      };
    } catch (error) {
      console.error("Error updating team role:", error);
      throw new InternalServerError("Failed to update team role");
    }
  },
});

export const getTeamRole = createTool({
  name: "TEAM_ROLE_GET",
  description: "Get detailed information about a specific team role",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      roleId: z.number(),
    }),
  ),
  handler: async (props, c) => {
    const { teamId, roleId } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    try {
      // Get role with policies using PolicyClient
      const roleWithPolicies = await c.policy.getRoleWithPolicies(
        teamId,
        roleId,
      );

      if (!roleWithPolicies) {
        throw new NotFoundError(
          "Role not found or doesn't belong to this team",
        );
      }

      // Get assigned members
      const { data: memberRoles } = await c.db
        .from("member_roles")
        .select("role_id, members!inner(team_id, user_id)")
        .eq("role_id", roleId)
        .eq("members.team_id", teamId);

      const getIntegrationId = (statement: Statement) => {
        if (statement.matchCondition?.resource === "is_integration") {
          const { uuid: integrationId } = parseId(
            statement.matchCondition.integrationId,
          );
          return integrationId;
        }
        const wellKnownGroup = resourceGroupMap.get(statement.resource);
        return getIntegrationIdForGroup(wellKnownGroup);
      };

      // Parse tools from policies
      const tools: Record<string, ToolPermission[]> = {};
      if (roleWithPolicies.policies) {
        roleWithPolicies.policies.forEach((policy) => {
          if (policy.statements) {
            policy.statements.forEach((statement) => {
              const key = getIntegrationId(statement);
              if (!tools[key]) {
                tools[key] = [];
              }
              tools[key].push({
                toolName: statement.resource,
                effect: statement.effect,
              });
            });
          }
        });
      }

      // Extract member user IDs with grant action (existing members have granted access)
      const members =
        memberRoles?.map((mr) => ({
          user_id: mr.members.user_id,
          action: "grant" as const,
        })) || [];

      return {
        id: roleWithPolicies.id,
        name: roleWithPolicies.name,
        description: roleWithPolicies.description,
        team_id: roleWithPolicies.team_id,
        tools,
        agents: [], // TODO: Implement agent associations
        members,
      };
    } catch (error) {
      console.error("Error getting team role:", error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError("Failed to get team role");
    }
  },
});

export const addView = createTool({
  name: "TEAMS_ADD_VIEW",
  description: "Add a custom view or resource to a team",
  inputSchema: z.lazy(() =>
    z.object({
      view: z
        .object({
          id: z.string().describe("Unique identifier for the view"),
          title: z.string().describe("Display title for the view"),
          icon: z.string().describe("Icon identifier for the view"),
          type: z
            .enum(["custom", "resource"])
            .describe(
              "Type of view (custom for views, resource for resources)",
            ),
          // Integration-specific view machine name
          name: z.string().describe("Integration-specific view name"),
          tools: z
            .array(z.string())
            .optional()
            .describe("Optional list of tool names to enable for this view"),
          rules: z
            .array(z.string())
            .optional()
            .describe("Optional list of textual rules to persist in context"),
          integration: z.object({
            id: z.string().describe("Integration ID"),
          }),
          // Resource-specific fields
          resourceType: z
            .string()
            .optional()
            .describe("Type of resource (for resources only)"),
        })
        .describe("View or resource configuration to add"),
    }),
  ),
  handler: async (props, c) => {
    const { view } = props;

    assertHasWorkspace(c);
    const slug = c.workspace.slug;

    const { data: team, error: teamError } = await c.db
      .from("teams")
      .select("id")
      .eq("slug", slug)
      .single();

    if (teamError) throw teamError;
    if (!team) {
      throw new NotFoundError("Team not found.");
    }

    await assertTeamResourceAccess(c.tool.name, team.id, c);

    const { data: existingView, error: checkError } = await c.db
      .from("deco_chat_views")
      .select("id")
      .eq("id", view.id)
      .eq("team_id", team.id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingView) {
      throw new UserInputError(
        "A view with this ID already exists for this team.",
      );
    }

    const { data: newView, error: insertError } = await c.db
      .from("deco_chat_views")
      .insert([
        {
          id: view.id,
          title: view.title,
          icon: view.icon,
          type: view.type,
          integration_id: view.integration?.id,
          name: view.name,
          team_id: team.id,
          metadata: view.resourceType
            ? { resourceType: view.resourceType }
            : null,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return newView;
  },
});

export const removeView = createTool({
  name: "TEAMS_REMOVE_VIEW",
  description: "Remove a custom view or resource from a team",
  inputSchema: z.lazy(() =>
    z.object({
      viewId: z.string().describe("The ID of the view or resource to remove"),
    }),
  ),
  handler: async (props, c) => {
    const { viewId } = props;

    assertHasWorkspace(c);
    const slug = c.workspace.slug;

    // Get team by slug to get the team ID
    const { data: team, error: teamError } = await c.db
      .from("teams")
      .select("id")
      .eq("slug", slug)
      .single();

    if (teamError) throw teamError;
    if (!team) {
      throw new NotFoundError("Team not found.");
    }

    await assertTeamResourceAccess(c.tool.name, team.id, c);

    // Check if view exists
    const { data: existingView, error: checkError } = await c.db
      .from("deco_chat_views")
      .select("id")
      .eq("id", viewId)
      .eq("team_id", team.id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!existingView) {
      throw new NotFoundError("View not found for this team.");
    }

    // Remove the view
    const { error: deleteError } = await c.db
      .from("deco_chat_views")
      .delete()
      .eq("id", viewId)
      .eq("team_id", team.id);

    if (deleteError) throw deleteError;

    return { success: true };
  },
});

export const listProjects = createTool({
  name: "PROJECTS_LIST",
  description: "List projects for an organization",
  inputSchema: z.lazy(() =>
    z.object({
      org: z.string(),
    }),
  ),
  handler: async (props, c) => {
    c.resourceAccess.grant();

    assertPrincipalIsUser(c);
    const user = c.user;

    const { org } = props;
    const { data, error } = await c.db
      .from("deco_chat_projects")
      .select(
        "*, teams!inner(id, name, slug, theme, members!inner(id, user_id, admin, deleted_at))",
      )
      .eq("teams.slug", org)
      .eq("teams.members.user_id", user.id)
      .is("teams.members.deleted_at", null);

    if (error) throw error;

    return {
      items: data.map((project) => {
        if (typeof project.teams.slug !== "string") {
          throw new InternalServerError("Team slug is not a string");
        }

        return {
          id: project.id,
          title: project.title,
          slug: project.slug,
          avatar_url: project.icon,
          org: {
            id: project.teams.id,
            slug: project.teams.slug,
            avatar_url: ((project.teams.theme as Theme) || null)?.picture,
          },
          memberCount: project.teams.members.length,
        };
      }),
    };
  },
});

export const listRecentProjects = createTool({
  name: "PROJECTS_RECENT",
  description: "List recent projects for the current user based on activity",
  inputSchema: z.lazy(() =>
    z.object({
      // Prevent abuse: UI shows 12 by default; allow up to 24
      limit: z.number().int().min(1).max(24).optional().default(12),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          slug: z.string(),
          avatar_url: z.string().nullable(),
          org: z.object({
            id: z.number(),
            slug: z.string(),
            avatar_url: z.string().nullable().optional(),
          }),
          last_accessed_at: z.string().optional(),
        }),
      ),
    }),
  ),
  handler: async (props, c) => {
    assertPrincipalIsUser(c);
    c.resourceAccess.grant();

    const user = c.user;
    const { limit } = props;
    const effectiveLimit = Number(limit ?? 12);

    // Get latest user activity rows for projects (most recent first)
    const { data: activityData, error: activityError } = await c.db
      .from("user_activity")
      .select("value, created_at")
      .eq("user_id", user.id)
      .eq("resource", "project")
      .order("created_at", { ascending: false })
      // Fetch some extra to compensate for potential duplicates in activity
      .limit(Math.min(200, Math.max(50, effectiveLimit * 4)));

    if (activityError) throw activityError;

    if (!activityData || activityData.length === 0) {
      return { items: [] };
    }

    // Deduplicate by project id (value) keeping latest order
    const seen = new Set<string>();
    const orderedProjectIds = activityData
      .filter((row) => {
        if (!row.value) return false;
        if (seen.has(row.value)) return false;
        seen.add(row.value);
        return true;
      })
      .map((row) => String(row.value))
      .slice(0, effectiveLimit);

    if (orderedProjectIds.length === 0) {
      return { items: [] };
    }

    // Fetch the selected projects with access validation via members join
    const { data: projectsData, error: projectsError } = await c.db
      .from("deco_chat_projects")
      .select(
        `
        id,
        title,
        slug,
        icon,
        org_id,
        teams!inner (
          id,
          slug,
          theme,
          members!inner (user_id, deleted_at)
        )
      `,
      )
      .in("id", orderedProjectIds)
      .eq("teams.members.user_id", user.id)
      .is("teams.members.deleted_at", null);

    if (projectsError) throw projectsError;

    // Index projects by id for ordering
    const projectById = new Map<string, (typeof projectsData)[number]>();
    for (const p of projectsData ?? []) {
      projectById.set(String(p.id), p);
    }

    // Build a quick lookup for last access times (first seen = most recent)
    const lastAccessedByProjectId = new Map<string, string>();
    for (const row of activityData ?? []) {
      const pid = String(row.value);
      if (!lastAccessedByProjectId.has(pid)) {
        lastAccessedByProjectId.set(pid, row.created_at as string);
      }
    }

    // Build items preserving the activity order of projects
    const items = (
      await Promise.all(
        orderedProjectIds
          .map((projectId) => projectById.get(projectId))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map(async (project) => {
            // Sign org avatar URL like other endpoints
            const signedUrlCreator = buildSignedUrlCreator({
              c,
              existingBucketName: getWorkspaceBucketName(
                `/shared/${project.teams.slug}`,
              ),
            });
            const orgAvatar = await getAvatarFromTheme(
              project.teams.theme as unknown as Json,
              signedUrlCreator,
            );
            // Resolve project icon: sign relative paths using the same workspace bucket
            let projectAvatar: string | null = null;
            const icon = (project.icon as string | null) || null;
            if (icon) {
              if (/^https?:\/\//i.test(icon)) {
                projectAvatar = icon;
              } else {
                try {
                  projectAvatar = await signedUrlCreator(icon);
                } catch {
                  projectAvatar = null;
                }
              }
            }

            return {
              id: String(project.id),
              title: project.title,
              slug: project.slug,
              avatar_url: projectAvatar ?? orgAvatar ?? null,
              org: {
                id: project.teams.id,
                slug: String(project.teams.slug || ""),
                avatar_url: orgAvatar,
              },
              last_accessed_at:
                lastAccessedByProjectId.get(String(project.id)) || undefined,
            };
          }),
      )
    ).filter(Boolean);

    return { items };
  },
});

export const createProject = createTool({
  name: "PROJECTS_CREATE",
  description: "Create a new project in an organization",
  inputSchema: z.lazy(() =>
    z.object({
      org: z.string().describe("The organization slug"),
      slug: z.string().describe("The project slug (URL-friendly identifier)"),
      title: z.string().describe("The project title"),
      description: z.string().optional().describe("The project description"),
      icon: z.string().optional().describe("The project icon URL or path"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      avatar_url: z.string().nullable(),
      org: z.object({
        id: z.number(),
        slug: z.string(),
        avatar_url: z.string().nullable().optional(),
      }),
    }),
  ),
  handler: async (props, c) => {
    assertPrincipalIsUser(c);
    c.resourceAccess.grant();

    const user = c.user;
    const { org, slug, title, description, icon } = props;

    // First, verify the user has access to this organization
    const { data: orgData, error: orgError } = await c.db
      .from("teams")
      .select("id, slug, theme, members!inner(user_id, deleted_at)")
      .eq("slug", org)
      .eq("members.user_id", user.id)
      .is("members.deleted_at", null)
      .single();

    if (orgError || !orgData) {
      throw new Error("Organization not found or access denied");
    }

    // Check if project with this slug already exists in the org
    const { data: existingProject } = await c.db
      .from("deco_chat_projects")
      .select("id")
      .eq("org_id", orgData.id)
      .eq("slug", slug)
      .single();

    if (existingProject) {
      throw new Error(
        `A project with slug "${slug}" already exists in this organization`,
      );
    }

    // Create the new project
    const { data: newProject, error: createError } = await c.db
      .from("deco_chat_projects")
      .insert({
        org_id: orgData.id,
        slug,
        title,
        description: description || null,
        icon: icon || null,
      })
      .select("*, teams!inner(id, slug, theme)")
      .single();

    if (createError || !newProject) {
      throw new Error("Failed to create project");
    }

    if (typeof newProject.teams.slug !== "string") {
      throw new InternalServerError("Team slug is not a string");
    }

    return {
      id: newProject.id,
      title: newProject.title,
      slug: newProject.slug,
      avatar_url: newProject.icon,
      org: {
        id: newProject.teams.id,
        slug: newProject.teams.slug,
        avatar_url: ((newProject.teams.theme as Theme) || null)?.picture,
      },
    };
  },
});

export const updateProject = createTool({
  name: "PROJECTS_UPDATE",
  description: "Update an existing project's properties",
  inputSchema: z.lazy(() =>
    z.object({
      org: z.string().describe("The organization slug"),
      project: z.string().describe("The project slug"),
      data: z.object({
        title: z.string().optional().describe("The new title for the project"),
      }),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      avatar_url: z.string().nullable(),
      org: z.object({
        id: z.number(),
        slug: z.string(),
        avatar_url: z.string().nullable().optional(),
      }),
    }),
  ),
  handler: async (props, c) => {
    assertPrincipalIsUser(c);
    c.resourceAccess.grant();

    const user = c.user;
    const { org, project, data } = props;

    // First, verify the user has access to this project
    const { data: projectData, error: fetchError } = await c.db
      .from("deco_chat_projects")
      .select(
        "*, teams!inner(id, slug, theme, members!inner(user_id, deleted_at))",
      )
      .eq("teams.slug", org)
      .eq("slug", project)
      .eq("teams.members.user_id", user.id)
      .is("teams.members.deleted_at", null)
      .single();

    if (fetchError || !projectData) {
      throw new Error("Project not found or access denied");
    }

    // Update the project
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    const { data: updatedProject, error: updateError } = await c.db
      .from("deco_chat_projects")
      .update(updateData)
      .eq("id", projectData.id)
      .select("*, teams!inner(id, slug, theme)")
      .single();

    if (updateError || !updatedProject) {
      throw new Error("Failed to update project");
    }

    if (typeof updatedProject.teams.slug !== "string") {
      throw new InternalServerError("Team slug is not a string");
    }

    return {
      id: updatedProject.id,
      title: updatedProject.title,
      slug: updatedProject.slug,
      avatar_url: updatedProject.icon,
      org: {
        id: updatedProject.teams.id,
        slug: updatedProject.teams.slug,
        avatar_url: ((updatedProject.teams.theme as Theme) || null)?.picture,
      },
    };
  },
});

export const deleteProject = createTool({
  name: "PROJECTS_DELETE",
  description: "Delete a project by id",
  inputSchema: z.lazy(() =>
    z.object({
      projectId: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      success: z.boolean(),
      error: z.string().optional(),
    }),
  ),
  handler: async (props, c) => {
    if (typeof c.user.id !== "string") {
      throw new NotFoundError("User not found");
    }

    const { projectId } = props;

    const [project] = await c.drizzle
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const orgId = project.org_id;

    const [existingMember] = await c.drizzle
      .select()
      .from(membersTable)
      .where(
        and(
          eq(membersTable.team_id, orgId),
          eq(membersTable.user_id, c.user.id),
          isNull(membersTable.deleted_at),
        ),
      )
      .limit(1);

    if (!existingMember) {
      throw new ForbiddenError("You are not allowed to delete this project");
    }

    try {
      await c.drizzle.transaction(async (tx) => {
        // TODO: Delete project related entities.
        // This will probably fail for most people rn
        await tx.delete(projects).where(eq(projects.id, projectId));
      });
    } catch (error) {
      console.error("Error deleting project", error);

      const message = error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        error: message,
      };
    }

    return { success: true };
  },
});
