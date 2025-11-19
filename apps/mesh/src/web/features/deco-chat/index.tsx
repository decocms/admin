import { useMemo } from "react";
import { DecoChatButton } from "./components/deco-chat-button";
import { DecoChatSheet } from "./components/deco-chat-sheet";
import { useDecoChatOpen } from "./hooks/use-deco-chat-open";
import { useModelsBindingState } from "./hooks/use-models-binding";
import { useProjectContext } from "@/web/providers/project-context-provider";

export function DecoChatControl() {
  const { org: routeOrg } = useProjectContext();
  const { organization, connection, isReady } = useModelsBindingState();
  const { open, setOpen } = useDecoChatOpen();

  const orgSlug = organization?.slug;
  const organizationName = useMemo(
    () => organization?.name ?? organization?.slug ?? routeOrg ?? "",
    [organization, routeOrg],
  );

  if (!isReady || !connection || !orgSlug || orgSlug !== routeOrg) {
    return null;
  }

  return (
    <>
      <DecoChatButton disabled={!isReady} onClick={() => setOpen(true)} />
      <DecoChatSheet
        open={open}
        onOpenChange={setOpen}
        orgSlug={orgSlug}
        organizationName={organizationName}
        connection={connection}
      />
    </>
  );
}

