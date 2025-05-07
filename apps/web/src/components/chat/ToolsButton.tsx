import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, useMemo } from "react";
import { useTools } from "../../hooks/useTools.ts";
import { DockedToggleButton } from "../pageLayout.tsx";
import { useChatContext } from "./context.tsx";

function ToolsButton() {
  const { uiOptions } = useChatContext();
  const showThreadTools = uiOptions?.showThreadTools;
  if (typeof showThreadTools === "boolean" && !showThreadTools) {
    return null;
  }
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
  const tools_set = useTools(agentId, threadId);
  const numberOfTools = useMemo(
    () => Object.values(tools_set).reduce((acc, tool) => acc + tool.length, 0),
    [tools_set],
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
