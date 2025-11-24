import type { MCPTool } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useEffect, useState } from "react";
import { Form } from "@deco/ui/components/form.tsx";
import { useForm } from "react-hook-form";
import { ajvResolver } from "@hookform/resolvers/ajv";
import type { JSONSchema7 } from "json-schema";
import { generateDefaultValues } from "../json-schema/utils/generate-default-values.ts";
import JSONSchemaForm, { type SchemaType } from "../json-schema/index.tsx";
import { JsonViewer } from "../chat/json-viewer.tsx";

interface ToolCallFormProps {
  tool: MCPTool;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  rawMode: boolean;
  readOnly?: boolean;
}

export function RawJsonView({ json }: { json: unknown }) {
  return <JsonViewer data={json} />;
}

function ToolCallForm({
  tool,
  onSubmit,
  onCancel,
  isLoading,
  rawMode,
  readOnly,
}: ToolCallFormProps) {
  const [payload, setPayload] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initialize form with default values based on the schema
  const form = useForm<Record<string, SchemaType>>({
    defaultValues: generateDefaultValues(tool.inputSchema as JSONSchema7),
    // The type is correct, somehow it fails on ajv
    // oxlint-disable-next-line no-explicit-any
    resolver: ajvResolver(tool.inputSchema as any),
  });

  // Sync form values with raw JSON when toggling modes
  useEffect(() => {
    if (rawMode) {
      try {
        // Convert form data to JSON string when switching to raw mode
        setPayload(JSON.stringify(form.getValues(), null, 2));
      } catch {
        setPayload("{}");
      }
    } else {
      try {
        // Parse JSON and update form when switching to form mode
        const parsedPayload = JSON.parse(payload || "{}");
        form.reset(parsedPayload);
      } catch {
        // If JSON is invalid, show error but don't switch modes
        setError(
          "Invalid JSON payload. Please fix before switching to form mode.",
        );
      }
    }
  }, [rawMode]);

  const handleRawSubmit = async () => {
    try {
      const parsedPayload = JSON.parse(payload);
      setError(null);
      await onSubmit(parsedPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON payload");
    }
  };

  const handleFormSubmit = form.handleSubmit(async (data) => {
    try {
      setError(null);
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting form");
    }
  });

  return (
    <div className="space-y-4">
      {rawMode ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Input Schema</div>
            <RawJsonView json={tool.inputSchema} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Raw JSON Payload</div>
            <Textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Enter JSON payload..."
              className="font-mono bg-background"
              rows={10}
              disabled={isLoading}
            />
            {error && (
              <div className="text-sm text-destructive mt-2">{error}</div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleRawSubmit}
              className="flex-1 gap-2"
              disabled={isLoading || readOnly}
            >
              {isLoading ? (
                <>
                  <Spinner size="xs" />
                  Processing...
                </>
              ) : (
                "Execute Tool Call"
              )}
            </Button>
            {isLoading && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex items-center gap-2"
              >
                <Icon name="close" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Form {...form}>
          <JSONSchemaForm
            schema={tool.inputSchema as JSONSchema7}
            form={form}
            disabled={isLoading}
            onSubmit={handleFormSubmit}
            error={error}
            submitButton={
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={isLoading || readOnly}
              >
                {isLoading ? (
                  <>
                    <Spinner size="xs" />
                    Processing...
                  </>
                ) : (
                  "Execute Tool Call"
                )}
              </Button>
            }
          />
        </Form>
      )}
    </div>
  );
}
