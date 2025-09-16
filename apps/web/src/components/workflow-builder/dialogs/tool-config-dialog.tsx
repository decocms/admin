import { Form } from "@rjsf/shadcn";
import { RJSFSchema } from "@rjsf/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";

interface ToolConfigDialogProps {
  tool: {
    name: string;
    tool_name: string;
    integration: string;
    options?: Record<string, unknown>;
  };
  onSave: (options: Record<string, unknown>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ToolConfigDialog({
  tool,
  onSave,
  isOpen,
  onClose,
}: ToolConfigDialogProps) {
  const schema: RJSFSchema = {
    type: "object",
    title: `Configure ${tool.name}`,
    properties: {
      retry: {
        type: "number",
        title: "Retry Attempts",
        minimum: 0,
        default: 0,
      },
      timeout: {
        type: "number",
        title: "Timeout (ms)",
        minimum: 1000,
        default: 30000,
      },
    },
  };

  const handleSubmit = ({ formData }: { formData: Record<string, unknown> }) => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure Tool</DialogTitle>
        </DialogHeader>
        <Form schema={schema} formData={tool.options} onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
