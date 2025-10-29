import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";

interface ModeSelectorProps {
  mode: "decochat" | "decopilot";
  onModeChange: (mode: "decochat" | "decopilot") => void;
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  const decochatAgent = WELL_KNOWN_AGENTS.decochatAgent;
  const decopilotAgent = WELL_KNOWN_AGENTS.decopilotAgent;

  return (
    <Select value={mode} onValueChange={onModeChange}>
      <SelectTrigger className="w-[140px] h-8 border-none shadow-none hover:bg-transparent">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="decochat">
          <div className="flex items-center gap-2">
            <img
              src={decochatAgent.avatar}
              alt={decochatAgent.name}
              className="size-4 rounded"
            />
            <span>{decochatAgent.name}</span>
          </div>
        </SelectItem>
        <SelectItem value="decopilot">
          <div className="flex items-center gap-2">
            <img
              src={decopilotAgent.avatar}
              alt={decopilotAgent.name}
              className="size-4 rounded"
            />
            <span>{decopilotAgent.name}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
