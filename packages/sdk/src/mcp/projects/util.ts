import { eq } from "drizzle-orm";
import { projects } from "../schema";
import { AppContext } from "../context";
import { assertHasWorkspace } from "../assertions";

export async function getProjectIdFromContext(
  c: AppContext,
): Promise<string | null> {
  if (!c.locator?.project) {
    return null;
  }
  const project = await c.drizzle
    .select()
    .from(projects)
    .where(eq(projects.slug, c.locator?.project))
    .limit(1)
    .then((r) => r[0]);
  return project?.id ?? null;
}

export function buildWorkspaceOrProjectIdConditions(
  workspace: string,
  projectId: string | null,
): string {
  const orConditions = [`workspace.eq.${workspace}`];
  if (projectId !== null) {
    orConditions.push(`project_id.eq.${projectId}`);
  }
  return orConditions.join(",");
}

/**
 * Supabase OR condition that filters by workspace or project id.
 * Used temporarily for the migration to the new schema. Soon will be removed in favor of
 * always using the project locator.
 *
 * Also is kinda bad doing 2 queries
 */
export async function workspaceOrProjectIdConditions(
  c: AppContext,
): Promise<string> {
  assertHasWorkspace(c);
  const projectId = await getProjectIdFromContext(c);
  return buildWorkspaceOrProjectIdConditions(c.workspace.value, projectId);
}
