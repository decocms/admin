import { useEffect } from "react";
import { DefaultValues, FieldValues, Resolver, useForm } from "react-hook-form";

/**
 * useForm that persists not submitted changes to localStorage.
 *
 * For correct behavior, remember to:
 *
 * Call onMutationSuccess() when the submit is successful.
 * Call discardChanges() when the changes are discarded.
 *
 * Responsibility of the caller to fire these events.
 */
export function usePersistedDirtyForm<T extends FieldValues>({
  defaultValues,
  resolver,
  persist,
  getOverrides,
}: {
  defaultValues: T;
  resolver: Resolver<T>;
  persist: (value: T | null) => void;
  getOverrides: () => T | null;
}) {
  const form = useForm<T>({
    defaultValues: defaultValues as DefaultValues<T>,
    resolver,
  });

  const formValues = form.watch();
  useEffect(() => {
    if (form.formState.isDirty) {
      persist(formValues);
    }
  }, [formValues]);

  useEffect(() => {
    const overrides = getOverrides();
    if (overrides) {
      form.reset(overrides);
    }

    if (!overrides && defaultValues) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form]);

  return {
    form,
    discardChanges: () => form.reset(defaultValues),
    onMutationSuccess: () => persist(null),
  };
}
