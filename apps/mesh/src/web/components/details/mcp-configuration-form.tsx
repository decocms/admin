import { createToolCaller } from "@/tools/client";
import type { ConnectionEntity } from "@/tools/connection/schema";
import { IntegrationIcon } from "@/web/components/integration-icon.tsx";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { BindingSelector } from "../binding-selector";

/**
 * Parsed configuration field from schema
 */
interface BindingToolSchema {
  name: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

type FieldType = "string" | "number" | "boolean" | "enum" | "binding";

interface ConfigField {
  id: string;
  label: string;
  description?: string;
  type: FieldType;
  // For binding fields
  bindingType?: string; // e.g., "@deco/veo3-bb8709c4fa8fe081f2cf27d8364ec254"
  bindingSchema?: BindingToolSchema[] | string; // Array of tool definitions or well-known binding name
  // For enum fields
  enumOptions?: string[];
  // For number fields
  min?: number;
  max?: number;
  // Current value
  value: string | number | boolean;
  defaultValue?: string | number | boolean;
}

/**
 * Parse the stateSchema to extract configuration fields
 */
function parseSchemaToFields(
  schema: Record<string, unknown>,
  formState: Record<string, unknown>,
): ConfigField[] {
  const fields: ConfigField[] = [];
  const properties = schema.properties as Record<string, unknown> | undefined;

  if (!properties) return fields;

  for (const [key, propSchema] of Object.entries(properties)) {
    const prop = propSchema as Record<string, unknown>;
    const propProperties = prop.properties as
      | Record<string, unknown>
      | undefined;
    const propType = prop.type as string | undefined;

    // Format label from key
    const label =
      (prop.title as string) ||
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const description = prop.description as string | undefined;

    // Check if this is a binding field (has __type or __binding property)
    const typeProperty = propProperties?.__type as
      | Record<string, unknown>
      | undefined;
    const bindingType = typeProperty?.const as string | undefined;
    const bindingProperty = propProperties?.__binding as
      | Record<string, unknown>
      | undefined;
    const bindingSchema = bindingProperty?.const as
      | BindingToolSchema[]
      | string
      | undefined;

    if (bindingType || bindingSchema) {
      // Binding field
      const stateValue = formState[key] as Record<string, unknown> | undefined;
      const currentValue = (stateValue?.value as string) || "";

      fields.push({
        id: key,
        label,
        description,
        type: "binding",
        bindingType,
        bindingSchema,
        value: currentValue,
      });
      continue;
    }

    // Handle primitive types
    const defaultValue = prop.default;
    const stateValue = formState[key];

    if (propType === "boolean") {
      fields.push({
        id: key,
        label,
        description,
        type: "boolean",
        value:
          stateValue !== undefined
            ? Boolean(stateValue)
            : Boolean(defaultValue ?? false),
        defaultValue: defaultValue as boolean,
      });
    } else if (propType === "number" || propType === "integer") {
      fields.push({
        id: key,
        label,
        description,
        type: "number",
        value:
          stateValue !== undefined
            ? Number(stateValue)
            : Number(defaultValue ?? 0),
        defaultValue: defaultValue as number,
        min: prop.minimum as number | undefined,
        max: prop.maximum as number | undefined,
      });
    } else if (propType === "string" && prop.enum) {
      // Enum field (string with enum constraint)
      fields.push({
        id: key,
        label,
        description,
        type: "enum",
        enumOptions: prop.enum as string[],
        value: (stateValue as string) ?? (defaultValue as string) ?? "",
        defaultValue: defaultValue as string,
      });
    } else {
      // Default to string
      fields.push({
        id: key,
        label,
        description,
        type: "string",
        value: (stateValue as string) ?? (defaultValue as string) ?? "",
        defaultValue: defaultValue as string,
      });
    }
  }

  return fields;
}

interface McpConfigurationResult {
  stateSchema: Record<string, unknown>;
  scopes?: string[];
}

export interface McpConfigurationFormProps {
  connection: ConnectionEntity;
  formState: Record<string, unknown>;
  onFormStateChange: (state: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function McpConfigurationForm({
  connection,
  formState,
  onFormStateChange,
}: McpConfigurationFormProps) {
  const toolCaller = useMemo(
    () => createToolCaller(connection.id),
    [connection.id],
  );
  const { data: configResult, isLoading, error } = useToolCall<
    Record<string, never>,
    McpConfigurationResult
  >({
    toolCaller,
    toolName: "MCP_CONFIGURATION",
    toolInputParams: {},
    enabled: !!connection.id,
  });
  const stateSchema = configResult?.stateSchema ?? {
    type: "object",
    properties: {},
  };

  // Parse schema to get field definitions
  const fields = useMemo(
    () => parseSchemaToFields(stateSchema, formState),
    [stateSchema, formState],
  );

  const handleValueChange = (
    fieldId: string,
    newValue: string | number | boolean,
  ) => {
    const field = fields.find((f) => f.id === fieldId);

    if (field?.type === "binding") {
      // For binding fields, store as object with value and __type
      const currentItem = formState[fieldId] as
        | Record<string, unknown>
        | undefined;
      onFormStateChange({
        ...formState,
        [fieldId]: {
          ...currentItem,
          value: newValue,
          ...(field?.bindingType && { __type: field.bindingType }),
        },
      });
    } else {
      // For primitive fields, store value directly
      onFormStateChange({
        ...formState,
        [fieldId]: newValue,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-20 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-20 items-center justify-center text-muted-foreground">
        Failed to load configuration: {(error as Error).message}
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No configuration available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className={`flex items-center gap-3 p-5 ${
            index < fields.length - 1 ? "border-b border-border" : ""
          }`}
        >
          {/* Integration Icon */}
          <IntegrationIcon
            icon={null}
            name={field.label}
            size="sm"
            className="shrink-0"
          />

          {/* Label and Description */}
          <div className="flex-1 min-w-0">
            <span className="text-sm text-foreground truncate block">
              {field.label}
            </span>
            {field.description && (
              <span className="text-xs text-muted-foreground truncate block">
                {field.description}
              </span>
            )}
          </div>

          {/* Render input based on field type */}
          {field.type === "binding" && (
            <BindingSelector
              value={field.value as string}
              onValueChange={(newValue) =>
                handleValueChange(field.id, newValue)
              }
              placeholder={`Select ${field.label.toLowerCase()}...`}
              binding={field.bindingSchema ?? field.bindingType}
              onAddNew={() => {}}
              className="w-[200px]"
            />
          )}

          {field.type === "string" && (
            <Input
              value={field.value as string}
              onChange={(e) => handleValueChange(field.id, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}...`}
              className="w-[200px] h-8"
            />
          )}

          {field.type === "number" && (
            <Input
              type="number"
              value={field.value as number}
              onChange={(e) =>
                handleValueChange(field.id, Number(e.target.value))
              }
              placeholder={`Enter ${field.label.toLowerCase()}...`}
              min={field.min}
              max={field.max}
              className="w-[200px] h-8"
            />
          )}

          {field.type === "boolean" && (
            <Select
              value={String(field.value)}
              onValueChange={(val) =>
                handleValueChange(field.id, val === "true")
              }
            >
              <SelectTrigger className="w-[200px] h-8">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
          )}

          {field.type === "enum" && field.enumOptions && (
            <Select
              value={field.value as string}
              onValueChange={(val) => handleValueChange(field.id, val)}
            >
              <SelectTrigger className="w-[200px] h-8">
                <SelectValue
                  placeholder={`Select ${field.label.toLowerCase()}...`}
                />
              </SelectTrigger>
              <SelectContent>
                {field.enumOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
    </div>
  );
}

