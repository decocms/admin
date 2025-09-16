import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent, CardHeader } from "@deco/ui/components/card.tsx";
import { useState } from "react";
import { SelectToolDialog } from "./select-tool-dialog.tsx";
import { MapperConfigDialog } from "./dialogs/mapper-config-dialog.tsx";

interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  integration: {
    name: string;
    id: string;
  };
}

interface MapperData {
  name: string;
  description: string;
  execute: string;
  outputSchema: Record<string, unknown>;
}

interface WorkflowPaletteProps {
  onAddTool: (tool: Tool) => void;
  onAddMapper: (mapperData: MapperData) => void;
}

export function WorkflowPalette({
  onAddTool,
  onAddMapper,
}: WorkflowPaletteProps) {
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [isMapperDialogOpen, setIsMapperDialogOpen] = useState(false);

  const handleAddTool = () => {
    setIsToolDialogOpen(true);
  };

  const handleSelectTool = (tool: Tool) => {
    onAddTool(tool);
  };

  const handleAddMapper = () => {
    setIsMapperDialogOpen(true);
  };

  const handleMapperSubmit = (mapperData: MapperData) => {
    onAddMapper(mapperData);
  };

  return (
    <div className="absolute top-4 right-4 z-10">
      <Card className="w-64 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="font-semibold text-sm">Add Components</h3>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={handleAddTool}
            variant="outline"
            className="w-full justify-start"
            size="sm"
          >
            <Icon name="build" className="h-4 w-4 mr-2" />
            Add Tool
          </Button>

          <Button
            onClick={handleAddMapper}
            variant="outline"
            className="w-full justify-start"
            size="sm"
          >
            <Icon name="transform" className="h-4 w-4 mr-2" />
            Add Mapper
          </Button>
        </CardContent>
      </Card>

      <SelectToolDialog
        open={isToolDialogOpen}
        onOpenChange={setIsToolDialogOpen}
        onSelectTool={handleSelectTool}
      />

      <MapperConfigDialog
        open={isMapperDialogOpen}
        onOpenChange={setIsMapperDialogOpen}
        onSubmit={handleMapperSubmit}
      />
    </div>
  );
}
