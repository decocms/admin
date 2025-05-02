import { HTTPException } from "hono/http-exception";
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

  throw new HTTPException(403, {
    message: "User does not have access to this team",
  });
};

export const assertUserHasAccessToTeamBySlug = async (
  { teamSlug, userId }: { teamSlug: string; userId: string },
  c: AppContext,
) => {
  const { data } = await c.get("db")
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

  throw new HTTPException(403, {
    message: "User does not have access to this workspace",
  });
};

export const assertUserHasAccessToWorkspace = async (
  root: string,
  slug: string,
  c: AppContext,
) => {
  const user = getContextUser(c);
  const db = c.get("db");

  if (!db) {
    throw new HTTPException(500, { message: "Missing database" });
  }

  // TODO: remove this hard coded access for @deco.cx
  const isAdmin = user?.email?.endsWith("@deco.cx");
  if (isAdmin) {
    return;
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
    throw new HTTPException(401, { message: "Unauthorized" });
  }
};
