import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors.ts";
import type { Workspace } from "../path.ts";
import type { AppContext, UserPrincipal } from "./context.ts";

type WithUser<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "user">
  & {
    user: UserPrincipal;
  };

type WithWorkspace<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "workspace">
  & {
    workspace: { root: string; slug: string; value: Workspace };
  };

export type WithTool<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "tool">
  & {
    tool: { name: string };
  };

export function assertHasWorkspace<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "workspace"> | Pick<WithWorkspace<TContext>, "workspace">,
): asserts c is WithWorkspace<TContext> {
  if (!c.workspace) {
    throw new NotFoundError();
  }
}

export function assertPrincipalIsUser<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "user"> | Pick<WithUser<TContext>, "user">,
): asserts c is WithUser<TContext> {
  if (!c.user || typeof c.user.id !== "string") {
    throw new NotFoundError();
  }
}

export const assertHasUser = (c: AppContext) => {
  if (c.isLocal) { // local calls
    return;
  }
  const user = c.user;

  if (!user) {
    throw new UnauthorizedError();
  }
};

export const assertWorkspaceResourceAccess = async (
  resource: string,
  c: AppContext,
): Promise<void> => {
  if (c.isLocal) {
    return c.resourceAccess.grant();
  }

  assertHasUser(c);
  assertHasWorkspace(c);

  const user = c.user;
  const { root, slug } = c.workspace;

  // agent tokens
  if ("aud" in user && user.aud === c.workspace.value) {
    return c.resourceAccess.grant();
  }

  if (root === "users" && user.id === slug) {
    return c.resourceAccess.grant();
  }

  if (root === "shared") {
    const canAccess = await c.authorization.canAccess(
      user.id as string,
      slug,
      resource,
    );

    if (canAccess) {
      return c.resourceAccess.grant();
    }
  }

  throw new ForbiddenError(
    `Cannot access ${resource} in workspace ${c.workspace.value}`,
  );
};

export const assertTeamResourceAccess = async (
  resource: string,
  teamIdOrSlug: string | number,
  c: AppContext,
): Promise<void> => {
  if (c.isLocal) {
    return c.resourceAccess.grant();
  }
  assertHasUser(c);
  const user = c.user;
  if ("id" in user && typeof user.id === "string") {
    const canAccess = await c.authorization.canAccess(
      user.id,
      teamIdOrSlug,
      resource,
    );

    if (canAccess) {
      return c.resourceAccess.grant();
    }
  }

  throw new ForbiddenError(
    `Cannot access ${resource} in team ${teamIdOrSlug}`,
  );
};

export const assertIntegrationBelongsToWorkspace = async (
  integrationId: string,
  c: AppContext,
): Promise<void> => {
  // Import parseId locally to avoid circular dependencies
  const parseId = (id: string) => {
    const [type, uuid] = id.includes(":") ? id.split(":") : ["i", id];
    return {
      type: (type || "i") as "i" | "a",
      uuid: uuid || id,
    };
  };

  assertHasWorkspace(c);
  await assertWorkspaceResourceAccess("INTEGRATIONS_GET", c);

  const { uuid, type } = parseId(integrationId);

  // Check if it's an innate integration (these are workspace-agnostic)
  // DECO_UTILS and other innate integrations are available to all workspaces
  const INNATE_INTEGRATION_IDS = [
    "DECO_UTILS", // The main innate integration
  ];

  if (INNATE_INTEGRATION_IDS.includes(uuid)) {
    return; // Innate integrations are valid for all workspaces
  }

  // Check if it's a virtual integration (workspace-management, user-management, etc.)
  // These are dynamically created for each workspace and always valid
  const VIRTUAL_INTEGRATION_IDS = [
    "user-management",
    "workspace-management",
    "prompt-management",
    "file-management",
    "knowledge-base",
    "trigger-management",
    "wallet-management",
    "hosting-management",
    "channel-management",
  ];

  if (VIRTUAL_INTEGRATION_IDS.includes(uuid)) {
    return; // Virtual integrations are workspace-scoped but always valid
  }

  // Check if it's a knowledge base integration (these follow a special pattern)
  if (uuid.startsWith("knowledge-base-")) {
    return; // Knowledge base integrations are workspace-scoped but dynamically created
  }

  // For regular integrations, check database
  if (type === "i") {
    const { data, error } = await c.db
      .from("deco_chat_integrations")
      .select("workspace")
      .eq("id", uuid)
      .single();

    if (error || !data) {
      throw new NotFoundError(`Integration ${integrationId} not found`);
    }

    if (data.workspace !== c.workspace.value) {
      throw new ForbiddenError(
        `Integration ${integrationId} does not belong to workspace ${c.workspace.value}`,
      );
    }
  }

  // For agent integrations, check agents table
  if (type === "a") {
    const { data, error } = await c.db
      .from("deco_chat_agents")
      .select("workspace")
      .eq("id", uuid)
      .single();

    if (error || !data) {
      throw new NotFoundError(`Agent integration ${integrationId} not found`);
    }

    if (data.workspace !== c.workspace.value) {
      throw new ForbiddenError(
        `Agent integration ${integrationId} does not belong to workspace ${c.workspace.value}`,
      );
    }
  }
};
