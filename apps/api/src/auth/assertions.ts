import { AppContext } from "../utils/context.ts";

const getContextUser = (c: AppContext) => {
  assertHasUser(c);
  return c.get("user")!;
};

export const assertUserHasAccessToTeamById = async (
  { teamId, userId }: { teamId: number; userId: string },
  c: AppContext,
) => {
  const { data } = await c
    .get("db")
    .from("members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (data) {
    return;
  }

  throw new Error("User does not have access to this workspace");
};

export const assertUserHasAccessToTeamBySlug = async (
  { teamSlug, userId }: { teamSlug: string; userId: string },
  c: AppContext,
) => {
  const { data } = await c
    .get("db")
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

  throw new Error("User does not have access to this workspace");
};

export const assertUserHasAccessToWorkspace = async (
  root: string,
  slug: string,
  c: AppContext,
) => {
  const user = getContextUser(c);
  const db = c.get("db");

  if (!db) {
    throw new Error("Missing database");
  }

  if (root === "users" && user.id === slug) {
    return;
  }

  if (root === "shared") {
    await assertUserHasAccessToTeamBySlug(
      { userId: user.id, teamSlug: slug },
      c,
    );

    return;
  }

  throw new Error("User does not have access to this workspace");
};

export const assertHasUser = (c: AppContext) => {
  const user = c.get("user");

  if (!user) {
    throw new Error("User not found");
  }
};
