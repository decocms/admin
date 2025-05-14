import type { Agent, Member } from "@deco/sdk";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";

interface AuditFiltersProps {
  agents: Agent[];
  members: Member[];
  selectedAgent?: string;
  selectedUser?: string;
  onAgentChange: (value: string) => void;
  onUserChange: (value: string) => void;
}

export function AuditFilters({
  agents,
  members,
  selectedAgent,
  selectedUser,
  onAgentChange,
  onUserChange,
}: AuditFiltersProps) {
  // Ordenar membros por nome
  const sortedMembers = [...(members ?? [])].sort((a, b) => {
    const nameA = a.profiles?.metadata?.full_name || a.profiles?.email ||
      a.user_id;
    const nameB = b.profiles?.metadata?.full_name || b.profiles?.email ||
      b.user_id;
    return nameA.localeCompare(nameB);
  });
  return (
    <div className="flex gap-4 items-end overflow-x-auto">
      <div className="flex flex-col gap-2 min-w-[180px]">
        <Select
          value={selectedAgent ?? "all"}
          onValueChange={onAgentChange}
        >
          <SelectTrigger id="agent-select" className="w-full">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents?.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {sortedMembers.length > 0 && (
        <div className="flex flex-col gap-2 min-w-[180px]">
          <Select
            value={selectedUser ?? "all"}
            onValueChange={onUserChange}
          >
            <SelectTrigger id="user-select" className="w-full">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {sortedMembers.map((member) => {
                const name = member.profiles?.metadata?.full_name ||
                  member.profiles?.email || member.user_id;
                const email = member.profiles?.email;
                return (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <span>
                      {name}
                      {email && email !== name && (
                        <span className="ml-2 text-xs text-slate-400">
                          {email}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
