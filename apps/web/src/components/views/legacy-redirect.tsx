import { NotFoundError, parseViewMetadata } from "@deco/sdk";
import { Navigate, useParams } from "react-router";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";

export default function LegacyViewRedirect() {
  const { id } = useParams();
  const team = useCurrentTeam();
  const workspaceLink = useWorkspaceLink();

  if (!id) {
    throw new NotFoundError("View not found");
  }

  const legacy = team.views.find((v) => v.id === id);
  const meta = legacy ? parseViewMetadata(legacy) : null;
  const integId = (legacy?.metadata as any)?.integration?.id as
    | string
    | undefined;
  const vName = (legacy?.metadata as any)?.viewName as string | undefined;

  if (legacy && meta?.type === "custom" && integId) {
    return (
      <Navigate
        to={workspaceLink(`/${integId}/views/${vName ?? "index"}`)}
        replace
      />
    );
  }

  throw new NotFoundError("View not found");
}


