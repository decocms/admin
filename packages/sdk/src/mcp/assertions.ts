import { AppContext } from "./context.ts";
import {
  CannotAccessWorkspaceError,
  ForbiddenError,
  MissingDatabaseError,
  UnauthorizedError,
} from "./errors.ts";

const getContextUser = (c: AppContext) => {
  assertHasUser(c);
  return c.user!;
};

type WithWorkspace = Omit<AppContext, "workspace"> & {
  workspace: { root: string; slug: string; value: string };
};

export function assertHasWorkspace(
  c: Pick<AppContext, "workspace"> | Pick<WithWorkspace, "workspace">,
): asserts c is WithWorkspace {
  if (!c.workspace) {
    throw new CannotAccessWorkspaceError();
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

  throw new ForbiddenError();
};

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
    throw new MissingDatabaseError();
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
    await assertUserHasAccessToTeamBySlug(
      { userId: user.id, teamSlug: c.workspace.slug },
      c,
    );

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
