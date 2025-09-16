import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useState } from "react";

interface MapperData {
  name: string;
  description: string;
  execute: string;
  outputSchema: Record<string, unknown>;
}

interface MapperConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (mapperData: MapperData) => void;
}

export function MapperConfigDialog({
  open,
  onOpenChange,
  onSubmit,
}: MapperConfigDialogProps) {
  const [name, setName] = useState("New Mapper");
  const [description, setDescription] = useState(
    "Transform data between workflow steps",
  );
  const [execute, setExecute] = useState(`export default async function(ctx) {
  const input = await ctx.readStepResult('previous-step');
  return input; // Identity transformation
}`);

  const handleSubmit = () => {
    onSubmit({
      name,
      description,
      execute,
      outputSchema: {},
    });
    onOpenChange(false);

    // Reset form
    setName("New Mapper");
    setDescription("Transform data between workflow steps");
    setExecute(`export default async function(ctx) {
  const input = await ctx.readStepResult('previous-step');
  return input; // Identity transformation
}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Mapper</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mapper-name">Name</Label>
            <Input
              id="mapper-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter mapper name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mapper-description">Description</Label>
            <Textarea
              id="mapper-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this mapper does"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mapper-execute">Execute Function</Label>
            <Textarea
              id="mapper-execute"
              value={execute}
              onChange={(e) => setExecute(e.target.value)}
              placeholder="Enter the mapper function code"
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This function receives a context object with access to previous
              step results. Use <code>ctx.readStepResult('step-name')</code> to
              read data from previous steps.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Mapper</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
