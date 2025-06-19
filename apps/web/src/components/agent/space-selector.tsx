import { type Space } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

interface SpaceSelectorProps {
  spaces: Space[];
  currentSpaceId?: string;
  onSpaceChange: (spaceId: string) => void;
  onSaveNewSpace: (title: string, spaceId: string) => void;
  className?: string;
}

export function SpaceSelector({
  spaces,
  currentSpaceId,
  onSpaceChange,
  onSaveNewSpace,
  className,
}: SpaceSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSpaceTitle, setNewSpaceTitle] = useState("");
  const navigate = useNavigate();
  const params = useParams();

  const currentSpace = spaces.find(s => s.id === currentSpaceId) || spaces[0];

  const handleSaveNewSpace = () => {
    if (newSpaceTitle.trim()) {
      const spaceId = crypto.randomUUID();
      onSaveNewSpace(newSpaceTitle.trim(), spaceId);
      setNewSpaceTitle("");
      setIsDialogOpen(false);
      
      // Update URL to include the space
      const newUrl = `${window.location.pathname}?space=${spaceId}`;
      navigate(newUrl, { replace: true });
    }
  };

  const handleSpaceSelect = (spaceId: string) => {
    onSpaceChange(spaceId);
    
    // Update URL to include the space
    const newUrl = `${window.location.pathname}?space=${spaceId}`;
    navigate(newUrl, { replace: true });
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 data-[state=open]:bg-accent"
          >
            <Icon name="layers" size={14} />
            <span className="text-sm font-medium">
              {currentSpace?.title || "Edit"}
            </span>
            <Icon name="keyboard_arrow_down" size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {spaces.map((space) => (
            <DropdownMenuItem
              key={space.id}
              onSelect={() => handleSpaceSelect(space.id)}
              className={cn(
                "flex items-center justify-between",
                currentSpaceId === space.id && "bg-accent"
              )}
            >
              <span>{space.title}</span>
              {currentSpaceId === space.id && (
                <Icon name="check" size={14} />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setIsDialogOpen(true);
                }}
                className="text-primary"
              >
                <Icon name="add" size={14} />
                <span>Save as New Space</span>
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save as New Space</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label htmlFor="space-title" className="text-sm font-medium">
                    Space Title
                  </label>
                  <Input
                    id="space-title"
                    value={newSpaceTitle}
                    onChange={(e) => setNewSpaceTitle(e.target.value)}
                    placeholder="Enter space title..."
                    className="mt-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveNewSpace();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveNewSpace}
                    disabled={!newSpaceTitle.trim()}
                  >
                    Save Space
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}