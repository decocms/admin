import { NotFoundError, parseViewMetadata } from "@deco/sdk";
import { useParams } from "react-router";
import { useCurrentTeam } from "../sidebar/team-selector";
import Preview from "../agent/preview";

export default function ViewDetail() {
  const { id } = useParams();
  const team = useCurrentTeam();

  const view = team.views.find((view) => view.id === id);
  if (!view) {
    throw new NotFoundError("View not found");
  }
  const meta = parseViewMetadata(view);

  if (meta?.type !== "custom") {
    throw new NotFoundError("View not found");
  }

  return <Preview src={meta.url} title={view.title} />;
}
