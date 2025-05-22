import { NotFoundError, UnauthorizedError } from "../errors.ts";
import { AppContext } from "./context.ts";
import { Workspace } from "../path.ts";

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

  if (root === "users" && user.id === slug) {
    return true;
  }

  if (root === "shared") {
    return await c.authorization.canAccess(user.id, slug, resource);
  }

  return false;
};

export const canAccessTeamResource = (
  resource: string,
  teamIdOrSlug: string | number,
  c: AppContext,
) => c.authorization.canAccess(c.user.id, teamIdOrSlug, resource);
