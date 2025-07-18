import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

interface SelectFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  options: string[];
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
}

export function SelectField<T extends FieldValues = FieldValues>({
  name,
  title,
  options,
  description,
  form,
  isRequired,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <FormField
      key={name}
      control={form.control}
      name={name as unknown as FieldPath<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {title}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
