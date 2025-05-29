import { Button } from "@deco/ui/components/button.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

interface Role {
  id: number;
  name: string;
}

interface RolesDropdownProps {
  roles: Role[];
  selectedRoles: Role[] | string[];
  onRoleClick: (role: Role, checked: boolean) => void;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
}

export function RolesDropdown({
  roles,
  selectedRoles,
  onRoleClick,
  disabled = false,
  triggerClassName,
  contentClassName,
}: RolesDropdownProps) {
  const isRoleSelected = (role: Role) => {
    if (Array.isArray(selectedRoles) && selectedRoles.length > 0) {
      // Handle both Role objects and string IDs
      if (typeof selectedRoles[0] === 'string') {
        return (selectedRoles as string[]).includes(role.id.toString());
      } else {
        return (selectedRoles as Role[]).some(selectedRole => selectedRole.id === role.id);
      }
    }
    return false;
  };

  const handleRoleClick = (role: Role, e: React.MouseEvent) => {
    e.preventDefault();
    const checked = isRoleSelected(role);
    
    // Don't allow removing the last role unless allowEmpty is true
    if (checked && selectedRoles.length <= 1) {
      toast.error("Member must have at least one role");
      return;
    }
    
    onRoleClick(role, !checked);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-5.5 w-5.5 p-0 rounded-md ${triggerClassName || ""}`}
          disabled={disabled}
        >
          <Icon name="add" size={14} />
          <span className="sr-only">Manage roles</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={`w-56 p-2 ${contentClassName || ""}`}
      >
        <div className="text-xs font-medium px-2 py-1.5">
          Roles
        </div>
        {roles.map((role) => {
          const checked = isRoleSelected(role);
          return (
            <DropdownMenuItem key={role.id} asChild>
              <div
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                onClick={(e) => handleRoleClick(role, e)}
              >
                <Checkbox
                  checked={checked}
                  className="h-4 w-4"
                  disabled={disabled}
                />
                <span className="capitalize">
                  {role.name}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}