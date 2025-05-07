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

// Helper function to check if user is admin of a team.
// Admin is the first user from the team
export async function assertUserIsTeamAdmin(
  c: AppContext,
  teamId: number,
  userId: string,
) {
  // TODO: implement Roles & Permission
  const { data: teamMember, error } = await c
    .get("db")
    .from("members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;
  if (!teamMember || teamMember.user_id !== userId) {
    throw new HTTPException(403, {
      message: "User does not have admin access to this team",
    });
  }
}

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

  // TODO (@gimenes): remove this hard coded access for @deco.cx by allowing
  // deco.cx users to enter in any workspace
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
