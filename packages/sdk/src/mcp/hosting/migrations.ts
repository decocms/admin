import type { Migration } from "./deployment.ts";

interface SingleStepMigration {
  old_tag?: string;
  new_tag?: string;
  new_classes?: string[];
  deleted_classes?: string[];
  renamed_classes?: {
    from: string;
    to: string;
  }[];
}

interface DoBinding {
  type: "durable_object_namespace";
  class_name: string;
  name: string;
}
const bindingIsEqual = (a: DoBinding, b: DoBinding): boolean => {
  return a.class_name === b.class_name;
};
const bindingsAreEqual = (a: DoBinding[], b: DoBinding[]): boolean => {
  return a.length === b.length &&
    a.every((binding, index) => bindingIsEqual(binding, b[index]));
};
const applyMigration = (currentBindings: DoBinding[]) =>
(
  [bindings, stepMigration]: [DoBinding[], SingleStepMigration],
  migration: Migration,
): [DoBinding[], SingleStepMigration] => {
  let bindingsResult: DoBinding[] = bindings;
  const shouldRunMigration = stepMigration.old_tag != null;
  if ("new_classes" in migration) {
    bindingsResult = [
      ...bindings,
      ...migration.new_classes.map((className) => ({
        class_name: className,
        name: className,
        type: "durable_object_namespace" as const,
      })),
    ];
    // we can accumulate the old tag if we have a new class migration
    if (shouldRunMigration) {
      stepMigration.new_classes = [
        ...(stepMigration.new_classes ?? []),
        ...migration.new_classes,
      ];
    }
  }
  if ("deleted_classes" in migration) {
    bindingsResult = bindings.filter((binding) =>
      !migration.deleted_classes.includes(binding.class_name)
    );
    if (shouldRunMigration) {
      stepMigration.deleted_classes = [
        ...(stepMigration.deleted_classes ?? []),
        ...migration.deleted_classes,
      ];
    }
  }
  if ("renamed_classes" in migration) {
    const renamedClasses = migration.renamed_classes.reduce(
      (acc, renamedClass) => {
        acc[renamedClass.from] = renamedClass.to;
        return acc;
      },
      {} as Record<string, string>,
    );
    bindingsResult = bindings.map((binding) => ({
      ...binding,
      class_name: renamedClasses[binding.class_name] ?? binding.class_name,
    }));
    if (shouldRunMigration) {
      stepMigration.renamed_classes = [
        ...(stepMigration.renamed_classes ?? []),
        ...migration.renamed_classes,
      ];
    }
  }
  if (bindingsAreEqual(bindingsResult, currentBindings)) {
    stepMigration.old_tag = migration.tag;
  }
  if (shouldRunMigration) {
    stepMigration.new_tag = migration.tag;
  }
  return [bindingsResult, stepMigration];
};
/**
 * Takes wrangler.toml migrations and do bindings and returns a single step migration
 */
export const migrationDiff = (
  allMigrations: Migration[],
  doBindings?: DoBinding[],
): SingleStepMigration | undefined => {
  const currentBindings = doBindings ?? [];
  const [_, migration]: [DoBinding[], SingleStepMigration] = allMigrations
    .reduce(
      applyMigration(currentBindings),
      [[], {} as SingleStepMigration],
    );
  if (!migration.new_tag || migration.old_tag === migration.new_tag) {
    return undefined;
  }
  return migration;
};
export function isDoBinding(
  binding: unknown | DoBinding,
): binding is DoBinding {
  return binding != null && typeof binding === "object" && "type" in binding &&
    binding.type === "durable_object_namespace";
}
