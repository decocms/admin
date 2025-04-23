import { Icon } from "@deco/ui/components/icon.tsx";
import { DockedToggleButton } from "../pageLayout.tsx";

function ActionsButton() {
  return (
    <DockedToggleButton
      id="actions"
      title="Actions"
      variant="outline"
      size="icon"
    >
      <Icon name="check_circle" />
    </DockedToggleButton>
  );
}

export default ActionsButton;
