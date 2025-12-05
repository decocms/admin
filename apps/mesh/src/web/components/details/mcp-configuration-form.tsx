import { createToolCaller } from "@/tools/client";
import type { ConnectionEntity } from "@/tools/connection/schema";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { Loader2 } from "lucide-react";
import { useMemo, useCallback } from "react";
import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import type { FieldTemplateProps, ObjectFieldTemplateProps } from "@rjsf/utils";
import { BindingSelector } from "../binding-selector";
import { useNavigate } from "@tanstack/react-router";

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

interface FormContext {
  onFieldChange: (fieldPath: string, value: unknown) => void;
  formData: Record<string, unknown>;
  onAddNew: () => void;
}

/**
 * Check if a schema property represents a binding field
 */
function isBindingField(schema: Record<string, unknown>): boolean {
  const properties = schema.properties as Record<string, unknown> | undefined;
  if (!properties) return false;

  const typeProperty = properties.__type as Record<string, unknown> | undefined;
  const bindingProperty = properties.__binding as
    | Record<string, unknown>
    | undefined;

  return !!(typeProperty?.const || bindingProperty?.const);
}

/**
 * Extract binding info from schema
 */
function getBindingInfo(schema: Record<string, unknown>): {
  bindingType?: string;
  bindingSchema?: unknown;
} {
  const properties = schema.properties as Record<string, unknown> | undefined;
  if (!properties) return {};

  const typeProperty = properties.__type as Record<string, unknown> | undefined;
  const bindingProperty = properties.__binding as
    | Record<string, unknown>
    | undefined;

  return {
    bindingType: typeProperty?.const as string | undefined,
    bindingSchema: bindingProperty?.const,
  };
}

/**
 * Extract field name from child element id
 * e.g., "root_llm___type" -> "llm", "root_model_value" -> "model"
 */
function extractFieldName(childId: string): string {
  // Remove "root_" prefix and get the first segment
  const withoutRoot = childId.replace(/^root_/, "");
  // Split by underscore and get the first part (the field name)
  const parts = withoutRoot.split("_");
  return parts[0] || "";
}

/**
 * Custom ObjectFieldTemplate that handles binding fields specially
 */
function CustomObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { schema, formData, title, description, registry } = props;
  const formContext = registry.formContext as FormContext | undefined;

  // Extract the field name from the first child element's content key/id
  // Each element in properties has a content with a key that contains the field path
  const firstChildKey = props.properties[0]?.content?.key as string | undefined;
  const fieldPath = firstChildKey
    ? extractFieldName(firstChildKey)
    : title?.toLowerCase().replace(/\s+/g, "_") || "";

  // Check if this is a binding field (has __type or __binding in properties)
  if (isBindingField(schema as Record<string, unknown>)) {
    const { bindingType, bindingSchema } = getBindingInfo(
      schema as Record<string, unknown>,
    );
    const currentValue = (formData?.value as string) || "";

    const handleBindingChange = (newValue: string) => {
      const newFieldData = {
        ...formData,
        value: newValue,
        ...(bindingType && { __type: bindingType }),
      };
      formContext?.onFieldChange(fieldPath, newFieldData);
    };

    // Format title to Title Case
    // e.g., "DATABASE" -> "Database", "llm_model" -> "Llm Model"
    const formatTitle = (str: string) =>
      str
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const displayTitle = title ? formatTitle(title) : formatTitle(fieldPath);

    return (
      <div className="flex items-center gap-3 justify-between">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium truncate block">
            {displayTitle}
          </label>
          {description && (
            <p className="text-xs text-muted-foreground truncate">
              {description}
            </p>
          )}
        </div>
        <BindingSelector
          value={currentValue}
          onValueChange={handleBindingChange}
          placeholder={`Select ${displayTitle.toLowerCase()}...`}
          binding={
            (bindingSchema as
              | string
              | Array<{
                  name: string;
                  inputSchema?: Record<string, unknown>;
                  outputSchema?: Record<string, unknown>;
                }>) ?? bindingType
          }
          onAddNew={() => formContext?.onAddNew()}
          className="w-[200px] shrink-0"
        />
      </div>
    );
  }

  // Default rendering for non-binding objects
  return (
    <div className="flex flex-col gap-4">
      {props.properties.map((element) => element.content)}
    </div>
  );
}

/**
 * Custom FieldTemplate for better styling
 */
function CustomFieldTemplate(props: FieldTemplateProps) {
  const { label, children, description, id, schema } = props;

  // Skip rendering for binding internal fields
  if (id.includes("__type") || id.includes("__binding")) {
    return null;
  }

  // For object types, let ObjectFieldTemplate handle everything
  if (schema.type === "object") {
    return children;
  }

  return (
    <div className="flex items-center gap-3 justify-between">
      <div className="flex-1 min-w-0">
        {label && (
          <label className="text-sm font-medium truncate block" htmlFor={id}>
            {label}
          </label>
        )}
        {description && (
          <p className="text-xs text-muted-foreground truncate">
            {description}
          </p>
        )}
      </div>
      <div className="w-[200px] shrink-0">{children}</div>
    </div>
  );
}

export function McpConfigurationForm({
  connection,
  formState,
  onFormStateChange,
}: McpConfigurationFormProps) {
  const { org } = useProjectContext();
  const navigate = useNavigate();
  const toolCaller = useMemo(
    () => createToolCaller(connection.id),
    [connection.id],
  );

  const {
    data: configResult,
    isLoading,
    error,
  } = useToolCall<Record<string, never>, McpConfigurationResult>({
    toolCaller,
    toolName: "MCP_CONFIGURATION",
    toolInputParams: {},
    enabled: !!connection.id,
  });

  const stateSchema = configResult?.stateSchema ?? {
    type: "object",
    properties: {},
  };

  const handleChange = useCallback(
    (data: { formData?: Record<string, unknown> }) => {
      if (data.formData) {
        onFormStateChange(data.formData);
      }
    },
    [onFormStateChange],
  );

  const handleFieldChange = useCallback(
    (fieldPath: string, value: unknown) => {
      const newFormState = { ...formState, [fieldPath]: value };
      onFormStateChange(newFormState);
    },
    [formState, onFormStateChange],
  );

  const handleAddNew = useCallback(() => {
    navigate({
      to: "/$org/mcps",
      params: { org },
      search: { action: "create" },
    });
  }, [navigate, org]);

  const formContext: FormContext = useMemo(
    () => ({
      onFieldChange: handleFieldChange,
      formData: formState,
      onAddNew: handleAddNew,
    }),
    [handleFieldChange, formState, handleAddNew],
  );

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

  const hasProperties =
    stateSchema.properties &&
    typeof stateSchema.properties === "object" &&
    Object.keys(stateSchema.properties).length > 0;

  if (!hasProperties) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No configuration available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-5">
      <Form
        schema={stateSchema}
        validator={validator}
        formData={formState}
        onChange={handleChange}
        formContext={formContext}
        liveValidate={false}
        showErrorList={false}
        templates={{
          ObjectFieldTemplate: CustomObjectFieldTemplate,
          FieldTemplate: CustomFieldTemplate,
        }}
      >
        {/* Hide default submit button */}
        <></>
      </Form>
    </div>
  );
}
