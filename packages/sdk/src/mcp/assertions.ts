import { LRUCache } from "lru-cache";
import {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../errors.ts";
import { AppContext } from "./context.ts";
import { Workspace } from "../path.ts";

const getContextUser = (c: AppContext) => {
  assertHasUser(c);
  return c.user!;
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

export const assertUserHasAccessToTeamById = async (
  { teamId, userId }: { teamId: number; userId: string },
  c: AppContext,
) => {
  const { data } = await c
    .db
    .from("members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (data) {
    return;
  }

  throw new ForbiddenError();
};

// Helper function to check if user is admin of a team.
// Admin is the first user from the team
export async function assertUserIsTeamAdmin(
  c: AppContext,
  teamId: number,
  userId: string,
) {
  // TODO: implement Roles & Permission
  const { data: teamMember, error } = await c
    .db
    .from("members")
    .select("user_id")
    .eq("team_id", teamId)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .single();

  if (error) throw error;
  if (!teamMember || teamMember.user_id !== userId) {
    throw new ForbiddenError();
  }
}

export const assertUserHasAccessToTeamBySlug = async (
  { teamSlug, userId }: { teamSlug: string; userId: string },
  c: AppContext,
) => {
  const { data } = await c.db
    .from("members")
    .select(`
      id,
      team:teams!inner (
        id,
        slug
      )
    `)
    .eq("user_id", userId)
    .eq("team.slug", teamSlug)
    .single();

  if (data) {
    return;
  }

  throw new ForbiddenError("User does not have access to this team");
};

const ONE_MINUTE_MS = 60e3;
const teamAccessCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: ONE_MINUTE_MS,
});
export const assertUserHasAccessToWorkspace = async (
  c: AppContext,
) => {
  if (c.isLocal) { // local calls
    return;
  }
  assertHasWorkspace(c);
  const user = getContextUser(c);
  const db = c.db;

  if (!db) {
    throw new InternalServerError("Missing database");
  }

  // TODO (@gimenes): remove this hard coded access for @deco.cx by allowing
  // deco.cx users to enter in any workspace
  const isAdmin = user?.email?.endsWith("@deco.cx");
  if (isAdmin) {
    return;
  }

  if (c.workspace.root === "users" && user?.id === c.workspace.slug) {
    return;
  }

  if (c.workspace.root === "shared") {
    const key = `${user.id}-${c.workspace.slug}`;
    if (teamAccessCache.has(key) && teamAccessCache.get(key) === true) {
      return;
    }
    await assertUserHasAccessToTeamBySlug(
      { userId: user.id, teamSlug: c.workspace.slug },
      c,
    );
    teamAccessCache.set(key, true);
    return;
  }

  throw new Error("User does not have access to this workspace");
};

export const assertHasUser = (c: AppContext) => {
  if (c.isLocal) { // local calls
    return;
  }
  const user = c.user;

  if (!user) {
    throw new UnauthorizedError();
  }
};

export const bypass = () => Promise.resolve(true);

export const canAccessWorkspaceResource = async (
  resource: string,
  c: AppContext,
): Promise<boolean> => {
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
