import { useThreadTools } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { DockedToggleButton } from "../pageLayout.tsx";
import { useChatContext } from "./context.tsx";

function ToolsButton() {
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
}

export default ToolsButton;
