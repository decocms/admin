import type { MCPTool } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useEffect, useState } from "react";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Form } from "@deco/ui/components/form.tsx";
import { useForm } from "react-hook-form";
import { ajvResolver } from "@hookform/resolvers/ajv";
import type { JSONSchema7 } from "json-schema";
import {
  Form as JSONSchemaForm,
  generateDefaultValues,
  type SchemaType,
} from "../../JSONSchemaForm/index.ts";

interface ToolCallFormProps {
  tool: MCPTool;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function ToolCallForm(
  { tool, onSubmit, onCancel, isLoading }: ToolCallFormProps,
) {
  const [rawMode, setRawMode] = useState(false);
  const [payload, setPayload] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initialize form with default values based on the schema
  const form = useForm<Record<string, SchemaType>>({
    defaultValues: generateDefaultValues(tool.inputSchema as JSONSchema7),
    // The type is correct, somehow it fails on ajv
    // deno-lint-ignore no-explicit-any
    resolver: ajvResolver(tool.inputSchema as any),
  });

  // Sync form values with raw JSON when toggling modes
  useEffect(() => {
    if (rawMode) {
      try {
        console.log(form.getValues());
        // Convert form data to JSON string when switching to raw mode
        setPayload(JSON.stringify(form.getValues(), null, 2));
      } catch (_err) {
        setPayload("{}");
      }
    } else {
      try {
        // Parse JSON and update form when switching to form mode
        const parsedPayload = JSON.parse(payload || "{}");
        form.reset(parsedPayload);
      } catch (_err) {
        // If JSON is invalid, show error but don't switch modes
        setError(
          "Invalid JSON payload. Please fix before switching to form mode.",
        );
        setRawMode(true); // Stay in raw mode
      }
    }
  }, [rawMode]);

  useEffect(function handleResetForm() {
    form.reset(generateDefaultValues(tool.inputSchema as JSONSchema7));
  }, [tool.name]);

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

  const toggleEditMode = () => {
    if (!rawMode) {
      // Going from form to raw - just update payload and switch
      try {
        setPayload(JSON.stringify(form.getValues(), null, 2));
        setRawMode(true);
      } catch (_err) {
        setPayload("{}");
        setRawMode(true);
      }
    } else {
      // Going from raw to form - validate JSON first
      try {
        const parsedPayload = JSON.parse(payload || "{}");
        form.reset(parsedPayload);
        setRawMode(false);
        setError(null);
      } catch (_err) {
        setError(
          "Invalid JSON payload. Please fix before switching to form mode.",
        );
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="text-sm font-medium">Form Mode</div>
        <Switch
          checked={!rawMode}
          onCheckedChange={() => toggleEditMode()}
          disabled={isLoading}
        />
        <div className="text-sm text-muted-foreground">
          {rawMode ? "Switch to form mode" : "Switch to raw JSON mode"}
        </div>
      </div>

      {rawMode
        ? (
          <div>
            <div>
              <div className="text-sm font-medium mb-2">Input Schema</div>
              <pre className="p-4 rounded-lg bg-muted text-sm overflow-auto">
          {JSON.stringify(tool.inputSchema, null, 2)}
              </pre>
            </div>

            <div className="text-sm font-medium mb-2">Raw JSON Payload</div>
            <Textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Enter JSON payload..."
              className="font-mono"
              rows={10}
              disabled={isLoading}
            />
            {error && (
              <div className="text-sm text-destructive mt-2">{error}</div>
            )}

            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleRawSubmit}
                className="flex-1 gap-2"
                disabled={isLoading}
              >
                {isLoading
                  ? (
                    <>
                      <Spinner size="xs" />
                      Processing...
                    </>
                  )
                  : "Execute Tool Call"}
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
        )
        : (
          <div>
            <div className="text-sm font-medium mb-2">Form Input</div>
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
                    disabled={isLoading}
                  >
                    {isLoading
                      ? (
                        <>
                          <Spinner size="xs" />
                          Processing...
                        </>
                      )
                      : "Execute Tool Call"}
                  </Button>
                }
              />
            </Form>
          </div>
        )}
    </div>
  );
}
