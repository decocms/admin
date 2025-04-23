import { useThreadTools } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, useMemo } from "react";
import { DockedToggleButton } from "../pageLayout.tsx";
import { useChatContext } from "./context.tsx";

function ToolsButton() {
  return (
    <Suspense fallback={<ToolsButton.Skeleton />}>
      <ToolsButton.UI />
    </Suspense>
  );
}

ToolsButton.Skeleton = () => (
  <DockedToggleButton
    id="tools"
    title="Chat settings"
    variant="outline"
    size="sm"
    disabled
  >
    <Icon name="build" />
  </DockedToggleButton>
);

ToolsButton.UI = () => {
  const { agentId, threadId } = useChatContext();
  const { data: tools } = useThreadTools(agentId, threadId);
  const numberOfTools = useMemo(
    () => Object.values(tools).reduce((acc, tool) => acc + tool.length, 0),
    [tools],
  );

  return (
    <DockedToggleButton
      id="tools"
      title="Chat settings"
      variant="outline"
      size="sm"
    >
      <Icon name="build" />
      <span className="text-xs">
        {numberOfTools}
      </span>
    </DockedToggleButton>
  );
};

export default ToolsButton;
