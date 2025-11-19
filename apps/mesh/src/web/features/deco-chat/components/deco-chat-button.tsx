import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface DecoChatButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export function DecoChatButton({ disabled, onClick }: DecoChatButtonProps) {
  return (
    <Button
      size="sm"
      variant="default"
      disabled={disabled}
      onClick={onClick}
      className="bg-lime-200/70 text-foreground hover:bg-lime-200 focus-visible:ring-lime-400/80 gap-2 rounded-full px-3 text-xs font-medium text-balance"
    >
      <span className="inline-flex size-5 items-center justify-center rounded-lg bg-lime-400 text-lime-950 shadow-sm">
        <Icon name="robot_2" size={16} />
      </span>
      deco chat
    </Button>
  );
}

