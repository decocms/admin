// filepath: /Users/igorbrasileiro/dev/deco/chat/apps/web/src/components/common/jsonSchemaForm/components/StringField.tsx
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

interface StringFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
}

export function StringField<T extends FieldValues = FieldValues>({
  name,
  title,
  description,
  form,
  isRequired,
  disabled
}: StringFieldProps<T>) {
  return (
    <FormField
      key={name}
      control={form.control}
      name={name as unknown as FieldPath<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{title}{isRequired && <span className="text-destructive ml-1">*</span>}</FormLabel>
          <FormControl>
            <Input {...field} disabled={disabled} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
