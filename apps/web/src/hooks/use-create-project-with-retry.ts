import { useCreateProject, type Project } from "@deco/sdk";
import { useCallback, useState } from "react";
import { useGenerateProjectName } from "./use-generate-project-name.ts";

interface CreateProjectWithRetryOptions {
  maxAttempts?: number;
}

interface CreateProjectWithRetryResult {
  createWithRetry: (orgSlug: string) => Promise<Project>;
  isPending: boolean;
}

/**
 * Hook to create a project with automatic retry logic for slug collisions.
 *
 * Generates random project names and automatically retries on slug collision errors
 * (detecting "slug" + exists/already/taken/duplicate in error messages).
 *
 * @param options - Configuration options
 * @param options.maxAttempts - Maximum number of retry attempts (default: 10)
 * @returns Object with createWithRetry function and isPending state
 *
 * @example
 * const { createWithRetry, isPending } = useCreateProjectWithRetry();
 * const project = await createWithRetry("my-org");
 */
export function useCreateProjectWithRetry(
  options: CreateProjectWithRetryOptions = {},
): CreateProjectWithRetryResult {
  const { maxAttempts = 10 } = options;
  const { generateName } = useGenerateProjectName();
  const createProject = useCreateProject();
  const [isRetrying, setIsRetrying] = useState(false);

  const createWithRetry = useCallback(
    async (orgSlug: string): Promise<Project> => {
      setIsRetrying(true);
      try {
        let project: Project | undefined;
        let attempt = 0;

        while (attempt < maxAttempts) {
          try {
            // Generate a new random name for each attempt
            const projectName = await generateName();
            const baseSlug = projectName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");

            project = await createProject.mutateAsync({
              org: orgSlug,
              slug: baseSlug,
              title: projectName,
            });
            break; // Success, exit loop
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            // Check if it's a slug collision error
            if (
              errorMsg.toLowerCase().includes("slug") &&
              (errorMsg.toLowerCase().includes("exists") ||
                errorMsg.toLowerCase().includes("already") ||
                errorMsg.toLowerCase().includes("taken") ||
                errorMsg.toLowerCase().includes("duplicate"))
            ) {
              attempt++;
              if (attempt >= maxAttempts) {
                throw new Error(
                  "Failed to create project: all name attempts failed",
                );
              }
              // Try next attempt with a new random name
              continue;
            }
            // Not a slug error, throw it
            throw err;
          }
        }

        if (!project) {
          throw new Error("Failed to create project");
        }

        return project;
      } finally {
        setIsRetrying(false);
      }
    },
    [maxAttempts, generateName, createProject],
  );

  return {
    createWithRetry,
    isPending: createProject.isPending || isRetrying,
  };
}

