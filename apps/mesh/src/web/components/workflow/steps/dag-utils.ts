import type { Step } from "@decocms/bindings/workflow";

/**
 * Extract all @ref dependencies from a step's input and forEach config
 */
export function getStepDependencies(
  step: Step,
  allStepNames: Set<string>,
): string[] {
  const deps: string[] = [];

  function traverse(value: unknown) {
    if (typeof value === "string") {
      const matches = value.match(/@(\w+)/g);
      if (matches) {
        for (const match of matches) {
          const refName = match.substring(1);
          if (allStepNames.has(refName)) {
            deps.push(refName);
          }
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(traverse);
    } else if (typeof value === "object" && value !== null) {
      Object.values(value).forEach(traverse);
    }
  }

  traverse(step.input);
  if (step.config?.loop?.for?.items) {
    traverse(step.config.loop.for.items);
  }

  return [...new Set(deps)];
}

/**
 * Compute topological level for each step
 * Level 0 = no dependencies, Level N = max(dependencies) + 1
 */
export function computeStepLevels(steps: Step[]): Map<string, number> {
  const stepNames = new Set(steps.map((s) => s.name));
  const levels = new Map<string, number>();

  const depsMap = new Map<string, string[]>();
  for (const step of steps) {
    depsMap.set(step.name, getStepDependencies(step, stepNames));
  }

  function getLevel(stepName: string, visited: Set<string>): number {
    if (levels.has(stepName)) return levels.get(stepName)!;
    if (visited.has(stepName)) return 0;

    visited.add(stepName);
    const deps = depsMap.get(stepName) || [];

    if (deps.length === 0) {
      levels.set(stepName, 0);
      return 0;
    }

    const maxDepLevel = Math.max(...deps.map((d) => getLevel(d, visited)));
    const level = maxDepLevel + 1;
    levels.set(stepName, level);
    return level;
  }

  for (const step of steps) {
    getLevel(step.name, new Set());
  }

  return levels;
}

/**
 * Group steps by their topological level
 */
export function groupStepsByLevel(steps: Step[]): Step[][] {
  const levels = computeStepLevels(steps);
  const maxLevel = Math.max(...Array.from(levels.values()), -1);

  const grouped: Step[][] = [];
  for (let level = 0; level <= maxLevel; level++) {
    const stepsAtLevel = steps.filter((s) => levels.get(s.name) === level);
    if (stepsAtLevel.length > 0) {
      grouped.push(stepsAtLevel);
    }
  }

  return grouped;
}

/**
 * Build edges for the DAG: [fromStep, toStep][]
 */
export function buildDagEdges(steps: Step[]): [string, string][] {
  const stepNames = new Set(steps.map((s) => s.name));
  const edges: [string, string][] = [];

  for (const step of steps) {
    const deps = getStepDependencies(step, stepNames);
    for (const dep of deps) {
      edges.push([dep, step.name]);
    }
  }

  return edges;
}
