interface BaseWorkspace {
  type: "teamId" | "userId";
}

interface TeamWorkspace {
  type: "teamId";
  id: number;
}

interface UserWorkspace {
  type: "userId";
  id: string;
}

type Workspace = TeamWorkspace | UserWorkspace;

export const parseWorkspace = (
  workspace: string, // accepts `/users/:id or users/:id
): Workspace => {
  const [userOrShared, id] = workspace.split("/").filter(Boolean);

  if (userOrShared === "shared" && typeof id === "string") {
    return {
      type: "teamId" as const,
      id: parseInt(id),
    };
  }

  if (typeof id === "string") {
    return {
      type: "userId" as const,
      id,
    };
  }

  throw new Error("Invalid workspace format");
};
