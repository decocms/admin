import { eq } from "drizzle-orm";
import { projects } from "../schema";
import { AppContext } from "../context";

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
