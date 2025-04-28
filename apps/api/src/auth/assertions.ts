import { AppContext } from "../utils/context.ts";
import { parseWorkspace } from "../utils/workspace.ts";

export const assertUserHasAccessToWorkspace = async (
  workspace: string,
  c: AppContext,
) => {
  const { type, id } = parseWorkspace(workspace);
  const user = c.get("user");
  const db = c.get("db");

  if (!user) {
    throw new Error("User not found");
  }

  if (!db) {
    throw new Error("Missing database");
  }

  if (type === "userId" && user.id === id) {
    return;
  }

  if (type === "teamId") {
    const { data, error } = await db
      .from("members")
      .select("*")
      .eq("team_id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return;
    }
  }

  throw new Error("User does not have access to this workspace");
};

export const assertHasUser = (c: AppContext) => {
  const user = c.get("user");

  if (!user) {
    throw new Error("User not found");
  }
};
