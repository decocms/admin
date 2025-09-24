import { and, eq } from "drizzle-orm";
import type { AuthContext, Statement } from "../auth/policy.ts";
import { SWRCache } from "../cache/swr.ts";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors.ts";
import { ProjectLocator } from "../locator.ts";
import type { Workspace } from "../path.ts";
import { matchByWorkspaceOrProjectLocatorForApiKeys } from "./agents/api.ts";
import type { AppContext, UserPrincipal } from "./context.ts";
import { apiKeys, organizations, projects } from "./schema.ts";

type WithUser<TAppContext extends AppContext = AppContext> = Omit<
  TAppContext,
  "user"
> & {
  user: UserPrincipal;
};

type WithWorkspace<TAppContext extends AppContext = AppContext> = Omit<
  TAppContext,
  "workspace"
> & {
  workspace: { root: string; slug: string; value: Workspace; branch: string };
};

type WithLocator<TAppContext extends AppContext = AppContext> = Omit<
  TAppContext,
  "locator"
> & {
  locator: {
    org: string;
    project: string;
    value: ProjectLocator;
    branch: string;
  };
};

type WithKbFileProcessor<TAppContext extends AppContext = AppContext> = Omit<
  TAppContext,
  "kbFileProcessor"
> & {
  kbFileProcessor: Workflow;
};

export type WithTool<TAppContext extends AppContext = AppContext> = Omit<
  TAppContext,
  "tool"
> & {
  tool: { name: string };
};

export function assertHasWorkspace<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "workspace"> | Pick<WithWorkspace<TContext>, "workspace">,
): asserts c is WithWorkspace<TContext> {
  if (!c.workspace) {
    throw new NotFoundError("Workspace not found");
  }
}

export function assertHasLocator<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "locator"> | Pick<WithLocator<TContext>, "locator">,
): asserts c is WithLocator<TContext> {
  if (!c.locator) {
    throw new NotFoundError("Locator not found");
  }
}

export function assertPrincipalIsUser<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "user"> | Pick<WithUser<TContext>, "user">,
): asserts c is WithUser<TContext> {
  if (!c.user || typeof c.user.id !== "string") {
    throw new NotFoundError("User not found");
  }
}

export const assertHasUser = (c: AppContext) => {
  if (c.isLocal) {
    // local calls
    return;
  }
  const user = c.user;

  if (!user) {
    throw new UnauthorizedError();
  }
};

const assertPoliciesIsStatementArray = (
  policies: unknown,
): policies is Statement[] => {
  return (
    Array.isArray(policies) &&
    policies.every(
      (p) => typeof p === "object" && "effect" in p && "resource" in p,
    )
  );
};

export function assertsNotNull<T>(
  value: T | null | undefined,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error("Value is null or undefined");
  }
}

const FIVE_SECONDS = 5;

type ApiKeyWithProject = typeof apiKeys.$inferSelect & {
  project?: typeof projects.$inferSelect | null;
};

export const apiKeySWRCache = new SWRCache<ApiKeyWithProject | null>(
  "api-key-swr",
  {
    staleTtlSeconds: FIVE_SECONDS,
  },
);

interface ResourceAccessContext extends Partial<Omit<AuthContext, "user">> {
  resource: string;
}

export const assertWorkspaceResourceAccess = async (
  c: AppContext,
  ..._resourcesOrContexts: Array<ResourceAccessContext | string>
): Promise<Disposable> => {
  if (c.isLocal || c.resourceAccess.granted()) {
    return c.resourceAccess.grant();
  }

  if (c.proxyToken) {
    const grant = await grantAccessForProxy(c);
    if (grant) {
      return grant;
    }
  }

  const resourcesOrContexts =
    _resourcesOrContexts.length === 0 && c.tool
      ? [c.tool.name]
      : _resourcesOrContexts;

  // If no resources provided, throw error
  if (resourcesOrContexts.length === 0) {
    throw new ForbiddenError("No resources specified for access check");
  }

  assertHasUser(c);
  assertHasWorkspace(c);

  const user = c.user;
  const { root, slug } = c.workspace;

  // Check each resource - if ANY succeeds, grant access
  const errors: string[] = [];

  // For API keys, query the database only once
  let apiKeyData: ApiKeyWithProject | null = null;
  let apiKeyError: string | null = null;

  // Check if this is an API key request and pre-fetch the data
  if (
    "aud" in user &&
    (user.aud === c.workspace.value || user.aud === c.locator?.value)
  ) {
    const [sub, id] = user.sub?.split(":") ?? [];
    if (sub === "api-key") {
      try {
        apiKeyData = await apiKeySWRCache.cache(async () => {
          const [data] = await c.drizzle
            .select({
              id: apiKeys.id,
              name: apiKeys.name,
              workspace: apiKeys.workspace,
              enabled: apiKeys.enabled,
              policies: apiKeys.policies,
              created_at: apiKeys.created_at,
              updated_at: apiKeys.updated_at,
              deleted_at: apiKeys.deleted_at,
              project_id: apiKeys.project_id,
              project: {
                id: projects.id,
                slug: projects.slug,
                title: projects.title,
                icon: projects.icon,
                description: projects.description,
                org_id: projects.org_id,
                created_at: projects.created_at,
              },
            })
            .from(apiKeys)
            .leftJoin(projects, eq(apiKeys.project_id, projects.id))
            .leftJoin(organizations, eq(projects.org_id, organizations.id))
            .where(
              and(
                eq(apiKeys.id, id),
                eq(apiKeys.enabled, true),
                matchByWorkspaceOrProjectLocatorForApiKeys(
                  c.workspace.value,
                  c.locator,
                ),
              ),
            )
            .limit(1);
          return data || null;
        }, `${c.workspace.value}:${id}`);
      } catch (error) {
        apiKeyError = (error as { message: string }).message;
      }
    }
  }

  for (const toolOrResourceContext of resourcesOrContexts) {
    try {
      const { resource, ...authContext } =
        typeof toolOrResourceContext === "string"
          ? { resource: toolOrResourceContext }
          : toolOrResourceContext;

      // agent tokens
      if (
        "aud" in user &&
        (user.aud === c.workspace.value || user.aud === c.locator?.value)
      ) {
        // API keys
        const [sub] = user.sub?.split(":") ?? [];
        if (sub === "api-key") {
          if (apiKeyError) {
            errors.push(`API key error for ${resource}: ${apiKeyError}`);
            continue;
          }
          if (!apiKeyData) {
            errors.push(
              `API key not found for ${resource} in workspace ${c.workspace.value}`,
            );
            continue;
          }

          // scopes should be a space-separated list of resources
          if (
            assertPoliciesIsStatementArray(apiKeyData.policies) &&
            !(await c.authorization.canAccess(
              apiKeyData.policies ?? [],
              slug,
              resource,
              authContext,
            ))
          ) {
            errors.push(
              `Cannot access ${resource} in workspace ${c.workspace.value}`,
            );
            continue;
          }
        }

        // If we reach here for this resource, access is granted
        return c.resourceAccess.grant();
      }

      if (root === "users" && user.id === slug) {
        // If we reach here for this resource, access is granted
        return c.resourceAccess.grant();
      }

      if (root === "shared") {
        const canAccess = await c.authorization.canAccess(
          user.id as string,
          slug,
          resource,
        );

        if (canAccess) {
          // If we reach here for this resource, access is granted
          return c.resourceAccess.grant();
        } else {
          errors.push(
            `Cannot access ${resource} in shared workspace ${c.workspace.value}`,
          );
        }
      } else {
        errors.push(
          `Cannot access ${resource} in workspace ${c.workspace.value}`,
        );
      }
    } catch (error) {
      errors.push(
        `Error checking access for resource: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // If we reach here, none of the resources granted access
  throw new ForbiddenError(
    `Cannot access any of the requested resources in workspace ${c.workspace.value} ${resourcesOrContexts}. Errors: ${errors.join(
      "; ",
    )}`,
  );
};

export const assertTeamResourceAccess = async (
  resource: string,
  teamIdOrSlug: string | number,
  c: AppContext,
): Promise<Disposable> => {
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

  throw new ForbiddenError(`Cannot access ${resource} in team ${teamIdOrSlug}`);
};

export function assertKbFileProcessor(
  c: AppContext,
): asserts c is WithKbFileProcessor<AppContext> {
  if (!c.kbFileProcessor) {
    throw new ForbiddenError("KbFileProcessor not found");
  }
}

export const DECO_MCP_PROXY_SUB_PREFIX = "deco-mcp-proxy";

export const IntegrationSub = {
  build: (integrationId: string) =>
    `${DECO_MCP_PROXY_SUB_PREFIX}:${integrationId}`,
  parse: (sub: string) => {
    const [prefix, integrationId] = sub.split(":");
    if (prefix !== DECO_MCP_PROXY_SUB_PREFIX) {
      throw new ForbiddenError("Invalid proxy token");
    }
    return integrationId;
  },
};

async function grantAccessForProxy(
  c: AppContext,
): Promise<Disposable | undefined> {
  if (!c.proxyToken) {
    throw new ForbiddenError("Proxy token not found");
  }

  if (
    !("integrationId" in c.user) ||
    typeof c.user.integrationId !== "string"
  ) {
    return undefined; // fallthrough to authorization
  }

  const integrationId = c.user.integrationId;
  const issuer = await c.jwtIssuer();
  const payload = await issuer.verify(c.proxyToken).catch(() => null);
  if (payload && payload.sub === IntegrationSub.build(integrationId)) {
    return c.resourceAccess.grant();
  }
  throw new ForbiddenError("Invalid proxy token");
}
