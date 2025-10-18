import { useMemo } from "react";
import type { JSONSchema7 } from "json-schema";
import type { AtRefOption } from "../components/workflow-builder/workflow-step-field.tsx";
import {
  useWorkflowFirstStepInput,
  useWorkflowStepOutputs,
  useWorkflowStepNames,
} from "../stores/workflows/hooks.ts";

/**
 * Infer a JSON Schema from a runtime value.
 * This helps filter references based on type compatibility.
 */
function inferSchemaFromValue(value: unknown): JSONSchema7 {
  if (value === null || value === undefined) {
    return { type: "null" } as JSONSchema7;
  }

  if (Array.isArray(value)) {
    const itemSchema: JSONSchema7 =
      value.length > 0
        ? inferSchemaFromValue(value[0])
        : ({ type: "string" } as JSONSchema7);
    return {
      type: "array",
      items: itemSchema,
    } as JSONSchema7;
  }

  if (typeof value === "object") {
    const properties: Record<string, JSONSchema7> = {};
    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferSchemaFromValue(val);
    }
    return {
      type: "object",
      properties,
    } as JSONSchema7;
  }

  if (typeof value === "string") {
    return { type: "string" } as JSONSchema7;
  }

  if (typeof value === "number") {
    return (
      Number.isInteger(value) ? { type: "integer" } : { type: "number" }
    ) as JSONSchema7;
  }

  if (typeof value === "boolean") {
    return { type: "boolean" } as JSONSchema7;
  }

  return { type: "string" } as JSONSchema7;
}

function addInputRefsRecursive(
  obj: Record<string, unknown>,
  refs: AtRefOption[],
  seen: Set<string>,
  path = "input",
  depth = 0,
): void {
  // Limit depth to avoid too many options
  if (depth >= 3) return;

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = `${path}.${key}`;
    const refValue = `@${fullPath}`;

    if (!seen.has(refValue)) {
      seen.add(refValue);
      const schema = inferSchemaFromValue(value);
      refs.push({
        value: refValue,
        label: fullPath,
        type: "input",
        description: `From workflow input: ${key}`,
        schema,
      });

      // Recursively add nested refs
      if (value && typeof value === "object" && !Array.isArray(value)) {
        addInputRefsRecursive(
          value as Record<string, unknown>,
          refs,
          seen,
          fullPath,
          depth + 1,
        );
      }
    }
  }
}

function addStepRefsRecursive(
  obj: Record<string, unknown>,
  refs: AtRefOption[],
  seen: Set<string>,
  stepName: string,
  path = stepName,
  depth = 0,
): void {
  // Limit depth to avoid too many options
  if (depth >= 3) return;

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = `${path}.${key}`;
    const refValue = `@${fullPath}`;

    if (!seen.has(refValue)) {
      seen.add(refValue);
      const schema = inferSchemaFromValue(value);
      refs.push({
        value: refValue,
        label: fullPath,
        type: "step",
        description: `From step: ${stepName}`,
        schema,
      });

      // Also add version with .output. prefix for compatibility
      if (path === stepName) {
        const outputRefValue = `@${path}.output.${key}`;
        if (!seen.has(outputRefValue)) {
          seen.add(outputRefValue);
          refs.push({
            value: outputRefValue,
            label: `${path}.output.${key}`,
            type: "step",
            description: `From step: ${stepName}`,
            schema,
          });
        }
      }

      // Recursively add nested refs
      if (value && typeof value === "object" && !Array.isArray(value)) {
        addStepRefsRecursive(
          value as Record<string, unknown>,
          refs,
          seen,
          stepName,
          fullPath,
          depth + 1,
        );
      }
    }
  }
}

/**
 * Optimized hook that generates available @ref options from previous steps and workflow input.
 * Uses memoization to avoid expensive recalculation on every render.
 */
export function useWorkflowAvailableRefs(stepName: string): AtRefOption[] {
  const firstStepInput = useWorkflowFirstStepInput();
  const stepOutputs = useWorkflowStepOutputs();
  const stepNames = useWorkflowStepNames();

  return useMemo((): AtRefOption[] => {
    const refs: AtRefOption[] = [];
    const seen = new Set<string>();

    // Add workflow input refs
    if (firstStepInput && typeof firstStepInput === "object") {
      addInputRefsRecursive(
        firstStepInput as Record<string, unknown>,
        refs,
        seen,
      );
    }

    // Add previous step output refs
    const currentStepIndex = stepNames.indexOf(stepName);
    for (let i = 0; i < currentStepIndex; i++) {
      const prevStepName = stepNames[i];
      const prevStepOutput = stepOutputs[prevStepName];

      // Add a ref to the whole step output first
      const wholeStepRef = `@${prevStepName}`;
      if (!seen.has(wholeStepRef)) {
        seen.add(wholeStepRef);
        const schema = inferSchemaFromValue(prevStepOutput);
        refs.push({
          value: wholeStepRef,
          label: prevStepName,
          type: "step",
          description: `Full output from step: ${prevStepName}`,
          schema,
        });
      }

      if (prevStepOutput && typeof prevStepOutput === "object") {
        addStepRefsRecursive(
          prevStepOutput as Record<string, unknown>,
          refs,
          seen,
          prevStepName,
        );
      }
    }

    return refs;
  }, [firstStepInput, stepOutputs, stepNames, stepName]);
}
