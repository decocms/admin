import { useParams } from "react-router";
import { useUser } from "./data/useUser.ts";
import type { Workspace } from "@deco/sdk";

export function useWorkspace(): Workspace {
  const { teamSlug } = useParams();
  const user = useUser();

  const isShared = !!teamSlug;

  return isShared ? `shared/${teamSlug}` : `users/${user.id}`;
}
