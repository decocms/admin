import { useThreadTools } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
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

  return (
    <DockedToggleButton
      id="tools"
      title="Chat settings"
      variant="outline"
      size="sm"
    >
      <Icon name="build" />
      <span className="text-xs">
        {Object.keys(tools).length}
      </span>
    </DockedToggleButton>
  );
};

export default ToolsButton;
