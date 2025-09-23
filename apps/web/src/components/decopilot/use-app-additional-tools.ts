import { useParams } from "react-router";
import { useGroupedApp } from "../integrations/apps";

export function useAppAdditionalTools() {
  const { appKey } = useParams();

  if (!appKey) return {};

  const data = useGroupedApp({ appKey });

  // TODO: change for the selected one
  const instance = data.instances?.[0] as
    | (typeof data.instances)[number]
    | undefined;

  if (!instance) return {};

  return {
    [instance.id]:
      (instance as unknown as { tools?: { name: string }[] })?.tools?.map(
        (tool) => tool.name,
      ) ?? [],
  };
}
