import { AppContext } from "../utils/context.ts";
import { parseWorkspace } from "../utils/workspace.ts";

const getContextUser = (c: AppContext) => {
  assertHasUser(c);
  return c.get("user")!;
};

export const assertUserHasAccessToTeam = async (
  { teamId, userId }: { teamId: number; userId: string },
  c: AppContext,
) => {
  const db = c.get("db");
  const { data, error } = await db
    .from("members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error("User does not have access to this workspace");
  }

  if (data) {
    return;
  }
};

export const assertUserHasAccessToWorkspace = async (
  workspace: string,
  c: AppContext,
) => {
  const { type, id } = parseWorkspace(workspace);
  const user = getContextUser(c);
  const db = c.get("db");

  if (!db) {
    throw new Error("Missing database");
  }

  if (type === "userId" && user.id === id) {
    return;
  }

  if (type === "teamId") {
    await assertUserHasAccessToTeam({
      userId: user.id,
      teamId: id,
    }, c);

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
