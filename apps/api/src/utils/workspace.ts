export const parseWorkspace = (
  workspace: string, // accepts `/users/:id or users/:id
) => {
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
