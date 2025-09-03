// deno-lint-ignore-file no-explicit-any
import { useMemo } from "react";
import { useParams } from "react-router";
import { parseViewMetadata, type View } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

export interface CurrentViewResult {
  view: View | undefined;
  meta: ReturnType<typeof parseViewMetadata>;
  integrationId: string | undefined;
}

export function useCurrentView(): CurrentViewResult {
  const { id: viewId } = useParams();
  const team = useCurrentTeam();

  const view = useMemo(
    () => team.views.find((v) => v.id === viewId),
    [team.views, viewId],
  );

  const meta = useMemo(() => (view ? parseViewMetadata(view) : null), [view]);
  const integrationId = (view?.metadata as any)?.integration?.id as
    | string
    | undefined;

  return { view, meta, integrationId };
}
