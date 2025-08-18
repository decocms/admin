// filepath: /Users/igorbrasileiro/dev/deco/chat/apps/web/src/components/common/jsonSchemaForm/components/NumberField.tsx
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@deco/ui/components/form.tsx';
import { Input } from '@deco/ui/components/input.tsx';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

interface NumberFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
}

export function NumberField<T extends FieldValues = FieldValues>({
  name,
  title,
  description,
  form,
  isRequired,
  disabled,
}: NumberFieldProps<T>) {
  return (
    <FormField
      key={name}
      control={form.control}
      name={name as unknown as FieldPath<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {title}
            {isRequired && <span className='text-destructive ml-1'>*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type='number'
              onChange={(e) => {
                const val = Number.isNaN(e.target.valueAsNumber) ? '' : e.target.valueAsNumber;
                field.onChange(val);
              }}
              disabled={disabled}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
