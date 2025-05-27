import {
  FeatureFeatureError,
  NotFoundError,
  UnauthorizedError,
} from "../errors.ts";
import { GatedFeature, Plan, PLANS_FEATURES } from "../plan.ts";
import { Workspace } from "../path.ts";
import { AppContext, UserPrincipal } from "./context.ts";

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

export const bypass = (): Promise<boolean> => Promise.resolve(true);

export const canAccessWorkspaceResource = async (
  resource: string,
  _: unknown,
  c: AppContext,
): Promise<boolean> => {
  if (c.isLocal) {
    return bypass();
  }
  assertHasUser(c);
  assertHasWorkspace(c);
  const user = c.user;
  const { root, slug } = c.workspace;

  // agent tokens
  if ("aud" in user && user.aud === c.workspace.value) {
    return true;
  }

  if (root === "users" && user.id === slug) {
    return true;
  }

  if (root === "shared") {
    return await c.authorization.canAccess(user.id as string, slug, resource);
  }

  return false;
};

export const canAccessTeamResource = (
  resource: string,
  teamIdOrSlug: string | number,
  c: AppContext,
) => {
  if (c.isLocal) {
    return bypass();
  }
  assertHasUser(c);
  const user = c.user;
  if ("id" in user && typeof user.id === "string") {
    return c.authorization.canAccess(user.id, teamIdOrSlug, resource);
  }
  return false;
};
