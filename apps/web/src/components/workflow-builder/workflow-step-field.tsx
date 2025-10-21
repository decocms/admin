import { Badge } from "@deco/ui/components/badge.tsx";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import type { JSONSchema7 } from "json-schema";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import type {
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  PathValue,
  UseFormReturn,
} from "react-hook-form";
import { JsonTextField } from "../json-schema/components/json-text-field.tsx";
import { ArrayField } from "../json-schema/components/array-field.tsx";
import { formatPropertyName } from "../json-schema/utils/schema.ts";

export interface AtRefOption {
  value: string;
  label: string;
  type: "step" | "input";
  description?: string;
  schema?: JSONSchema7; // Schema of the value this reference returns
}

interface WorkflowStepFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  schema: JSONSchema7;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
  availableRefs: AtRefOption[];
  isFirstStep: boolean;
  onFieldChange?: (name: string, value: unknown) => void;
}

function isAtRef(value: unknown): value is `@${string}` {
  return typeof value === "string" && value.startsWith("@");
}

/**
 * Check if a reference schema is compatible with a target field schema.
 * Returns true if the ref can be used for this field.
 */
function isSchemaCompatible(
  refSchema: JSONSchema7,
  targetSchema: JSONSchema7,
): boolean {
  // Extract the primary types (ignoring null)
  const getType = (schema: JSONSchema7): string | undefined => {
    if (Array.isArray(schema.type)) {
      return schema.type.find((t) => t !== "null");
    }
    return schema.type;
  };

  const refType = getType(refSchema);
  const targetType = getType(targetSchema);

  // If either type is unknown, allow it
  if (!refType || !targetType) {
    return true;
  }

  // For objects, check if properties are compatible
  if (refType === "object" && targetType === "object") {
    // If target has specific properties required, check if ref provides them
    if (targetSchema.properties && refSchema.properties) {
      const requiredProps = targetSchema.required || [];
      // Check if all required properties exist in the ref schema
      const hasAllRequired = requiredProps.every(
        (prop) => prop in refSchema.properties!,
      );
      return hasAllRequired;
    }
    // If no specific properties required, allow any object
    return true;
  }

  // For arrays, check if items are compatible
  if (refType === "array" && targetType === "array") {
    if (
      targetSchema.items &&
      refSchema.items &&
      typeof targetSchema.items === "object" &&
      typeof refSchema.items === "object" &&
      !Array.isArray(targetSchema.items) &&
      !Array.isArray(refSchema.items)
    ) {
      return isSchemaCompatible(refSchema.items, targetSchema.items);
    }
    return true;
  }

  // For primitives, types must match
  const matches = refType === targetType;
  return matches;
}

const WorkflowStepFieldComponent = function <
  T extends FieldValues = FieldValues,
>({
  name,
  schema,
  form,
  isRequired,
  disabled,
  availableRefs,
  isFirstStep,
}: WorkflowStepFieldProps<T>) {
  const currentValue = form.watch(name as FieldPath<T>);
  const disableReferenceMode = isFirstStep;

  // For first step, never allow reference mode; otherwise check if value is a reference
  const [isRefMode, setIsRefMode] = useState(
    !disableReferenceMode && isAtRef(currentValue),
  );

  // Store previous values for each mode to restore when switching back
  const previousValues = useRef<{ ref?: string; manual?: unknown }>({
    ref: isAtRef(currentValue) ? currentValue : undefined,
    manual: !isAtRef(currentValue) ? currentValue : undefined,
  });

  // Determine the field type from schema
  const fieldType = Array.isArray(schema.type)
    ? (schema.type.find((t) => t !== "null") ?? "string")
    : (schema.type ?? "string");

  const propertyName = name.split(".").pop() || name;
  const title =
    (schema.title as string | undefined) || formatPropertyName(propertyName);
  const description = schema.description as string | undefined;

  // Filter available refs to only show compatible types
  const compatibleRefs = useMemo(() => {
    const filtered = availableRefs.filter((ref) => {
      // If no schema info on the ref, allow it (backward compatibility)
      if (!ref.schema) {
        return true;
      }

      // Check if the ref's schema is compatible with the field's schema
      const isCompatible = isSchemaCompatible(ref.schema, schema);
      return isCompatible;
    });

    return filtered;
  }, [availableRefs, schema]);

  // Show toggle when refs are available OR already in ref mode (for all types)
  // But never show if reference mode is explicitly disabled
  const showToggle = useMemo(
    () => !disableReferenceMode && (compatibleRefs.length > 0 || isRefMode),
    [disableReferenceMode, compatibleRefs.length, isRefMode],
  );

  const handleToggleChange = useCallback(
    (checked: boolean) => {
      setIsRefMode(checked);

      // Save current value before switching
      if (checked) {
        // Switching to reference mode
        previousValues.current.manual = currentValue;
        // Restore previous reference value or clear
        const restoredValue = previousValues.current.ref || "";
        form.setValue(
          name as FieldPath<T>,
          restoredValue as PathValue<T, FieldPath<T>>,
        );
      } else {
        // Switching to manual mode
        previousValues.current.ref = currentValue;
        // Restore previous manual value or clear
        const restoredValue =
          previousValues.current.manual !== undefined
            ? previousValues.current.manual
            : "";
        form.setValue(
          name as FieldPath<T>,
          restoredValue as PathValue<T, FieldPath<T>>,
        );
      }
    },
    [currentValue, form, name],
  );

  return (
    <FormField
      control={form.control}
      name={name as FieldPath<T>}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between gap-2">
            <FormLabel className="flex items-center gap-2">
              <span>
                {title}
                {isRequired && <span className="text-destructive ml-1">*</span>}
              </span>
              {isRefMode && (
                <Badge variant="outline" className="text-xs font-normal">
                  <Icon name="link" size={12} className="mr-1" />
                  Reference Mode
                </Badge>
              )}
            </FormLabel>

            {showToggle && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {isRefMode ? "Using reference" : "Manual input"}
                </span>
                <Switch
                  checked={isRefMode}
                  onCheckedChange={handleToggleChange}
                  disabled={disabled}
                />
              </div>
            )}
          </div>

          <FormControl>
            {isRefMode ? (
              <ReferenceSelect
                value={field.value}
                onChange={field.onChange}
                options={compatibleRefs}
                disabled={disabled}
                placeholder="Select a reference..."
              />
            ) : (
              <ManualInput<T>
                field={field}
                fieldType={fieldType}
                schema={schema}
                disabled={disabled}
                form={form}
                isFirstStep={isFirstStep}
              />
            )}
          </FormControl>

          {description &&
            !isRefMode &&
            fieldType !== "object" &&
            fieldType !== "array" && (
              <FormDescription>{description}</FormDescription>
            )}
          {isRefMode && (
            <FormDescription className="text-primary/70">
              <Icon name="info" size={14} className="inline mr-1" />
              This field will use the value from a previous step or input
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const WorkflowStepField = memo(WorkflowStepFieldComponent) as <
  T extends FieldValues = FieldValues,
>(
  props: WorkflowStepFieldProps<T>,
) => React.ReactElement;

interface ReferenceSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: AtRefOption[];
  disabled: boolean;
  placeholder: string;
}

const ReferenceSelect = memo(function ReferenceSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: ReferenceSelectProps) {
  const inputRefs = useMemo(
    () => options.filter((opt) => opt.type === "input"),
    [options],
  );
  const stepRefs = useMemo(
    () => options.filter((opt) => opt.type === "step"),
    [options],
  );

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {value && (
            <div className="flex items-center gap-2">
              <Icon
                name={value.startsWith("@input") ? "input" : "settings"}
                size={14}
              />
              <span className="font-mono text-sm">{value}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {inputRefs.length > 0 && (
          <SelectGroup>
            <SelectLabel>Workflow Input</SelectLabel>
            {inputRefs.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <Icon name="input" size={14} />
                  <span className="font-mono text-xs">{opt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {stepRefs.length > 0 && (
          <SelectGroup>
            <SelectLabel>Previous Steps</SelectLabel>
            {stepRefs.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <Icon name="settings" size={14} />
                  <span className="font-mono text-xs">{opt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {options.length === 0 && (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No references available
          </div>
        )}
      </SelectContent>
    </Select>
  );
});

interface ManualInputProps<T extends FieldValues = FieldValues> {
  field: ControllerRenderProps<T, FieldPath<T>>;
  fieldType: string;
  schema: JSONSchema7;
  disabled: boolean;
  form?: UseFormReturn<T>;
  isFirstStep: boolean;
}

function ManualInputComponent<T extends FieldValues>({
  field,
  fieldType,
  schema,
  disabled,
  form,
  isFirstStep,
}: ManualInputProps<T>) {
  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      field.onChange(val === "" ? undefined : Number(val));
    },
    [field],
  );

  switch (fieldType) {
    case "string": {
      if (schema.enum) {
        return (
          <Select
            value={field.value || ""}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {(schema.enum as string[]).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      // Check if it's a long text (textarea) based on description or title
      const isLongText =
        (schema.maxLength && schema.maxLength > 200) ||
        schema.title?.toLowerCase().includes("description") ||
        schema.title?.toLowerCase().includes("content");

      if (isLongText) {
        return (
          <Textarea
            {...field}
            disabled={disabled}
            placeholder={`Enter ${schema.title?.toLowerCase() || "text"}...`}
            className="min-h-[100px] resize-y"
          />
        );
      }

      return (
        <Input
          {...field}
          value={field.value ?? ""}
          disabled={disabled}
          placeholder={`Enter ${schema.title?.toLowerCase() || "value"}...`}
        />
      );
    }

    case "number":
    case "integer":
      return (
        <Input
          {...field}
          value={field.value ?? ""}
          type="number"
          disabled={disabled}
          onChange={handleNumberChange}
          placeholder="Enter a number..."
        />
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={field.value ?? false}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">
            {field.value ? "Enabled" : "Disabled"}
          </span>
        </div>
      );

    case "object":
      if (!form) {
        return (
          <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
            <p className="text-sm text-muted-foreground">
              Object type requires form context
            </p>
          </div>
        );
      }
      if (schema.properties) {
        // Use NestedObjectField for objects with properties
        return (
          <NestedObjectField
            name={field.name}
            schema={schema}
            form={form}
            disabled={disabled}
            availableRefs={[]} // No refs in manual mode
            isFirstStep={isFirstStep}
          />
        );
      }
      // Fallback to JSON text field for objects without properties
      return (
        <JsonTextField
          name={field.name}
          title={schema.title as string}
          description={schema.description as string}
          form={form}
          isRequired={false}
          disabled={disabled}
        />
      );

    case "array": {
      if (!form) {
        return (
          <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
            <p className="text-sm text-muted-foreground">
              Array type requires form context
            </p>
          </div>
        );
      }
      // Create a RenderItem component for this specific array field
      const RenderItem = ({
        name: itemName,
        schema: itemSchema,
        title: itemTitle,
      }: {
        name: string;
        index: number;
        schema: JSONSchema7;
        title?: string;
      }) => (
        <ManualInput<T>
          field={{ ...field, name: itemName as FieldPath<T> }}
          fieldType={
            Array.isArray(itemSchema.type)
              ? (itemSchema.type.find((t) => t !== "null") ?? "string")
              : (itemSchema.type ?? "string")
          }
          schema={{ ...itemSchema, title: itemTitle }}
          disabled={disabled}
          form={form}
          isFirstStep={isFirstStep}
        />
      );

      return (
        <ArrayField
          name={field.name}
          title={schema.title as string}
          description={schema.description as string}
          form={form}
          isRequired={false}
          disabled={disabled}
          schema={schema}
          RenderItem={RenderItem}
        />
      );
    }

    default:
      return (
        <Input
          {...field}
          disabled={disabled}
          placeholder={`Enter ${fieldType}...`}
        />
      );
  }
}

interface NestedObjectFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  schema: JSONSchema7;
  form: UseFormReturn<T>;
  disabled: boolean;
  availableRefs: AtRefOption[];
  isFirstStep: boolean;
}

const NestedObjectFieldComponent = function <
  T extends FieldValues = FieldValues,
>({
  name,
  schema,
  form,
  disabled,
  availableRefs,
  isFirstStep,
}: NestedObjectFieldProps<T>) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const propertyName = name.split(".").pop() || name;
  const title =
    (schema.title as string | undefined) || formatPropertyName(propertyName);
  const description = schema.description as string | undefined;

  if (!schema.properties || typeof schema.properties !== "object") {
    return null;
  }

  const properties = Object.entries(schema.properties);

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon
            name={isCollapsed ? "chevron_right" : "expand_more"}
            size={20}
          />
          <div className="text-left">
            <h4 className="font-medium">{title}</h4>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {properties.length} {properties.length === 1 ? "field" : "fields"}
        </Badge>
      </button>

      {!isCollapsed && (
        <div className="p-4 pt-0 space-y-4 border-t">
          {properties.map(([propName, propSchema]) => {
            const fullName = `${name}.${propName}`;
            const isRequired = schema.required?.includes(propName) ?? false;

            return (
              <WorkflowStepField<T>
                key={fullName}
                name={fullName}
                schema={propSchema as JSONSchema7}
                form={form}
                isRequired={isRequired}
                disabled={disabled}
                availableRefs={availableRefs}
                isFirstStep={isFirstStep}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const NestedObjectField = memo(NestedObjectFieldComponent) as <
  T extends FieldValues = FieldValues,
>(
  props: NestedObjectFieldProps<T>,
) => React.ReactElement;

const ManualInput = memo(ManualInputComponent) as <T extends FieldValues>(
  props: ManualInputProps<T>,
) => React.ReactElement;
