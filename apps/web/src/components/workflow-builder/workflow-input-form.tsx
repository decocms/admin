import { Form } from "@rjsf/shadcn";
import { RJSFSchema, UiSchema } from "@rjsf/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";

interface WorkflowInputFormProps {
  schema: RJSFSchema;
  onSubmit: (data: Record<string, unknown>) => void;
  initialData?: Record<string, unknown>;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkflowInputForm({
  schema,
  onSubmit,
  initialData,
  isOpen,
  onClose,
}: WorkflowInputFormProps) {
  const uiSchema: UiSchema = {
    "ui:submitButtonOptions": {
      submitText: "Run Workflow",
      norender: false,
      props: {
        className: "w-full",
      },
    },
  };

  const handleSubmit = ({ formData }: { formData: Record<string, unknown> }) => {
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run Workflow</DialogTitle>
        </DialogHeader>
        <Form
          schema={schema}
          uiSchema={uiSchema}
          formData={initialData}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
