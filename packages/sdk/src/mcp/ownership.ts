import { PgSelect } from "drizzle-orm/pg-core";
import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { AppContext } from "./context.ts";
import { assertHasWorkspace, assertHasLocator } from "./assertions.ts";
import { projects, organizations } from "./schema.ts";
import { eq, or, and } from "drizzle-orm";

/**
 * Adds ownership checking to an agent query.
 * Curently filters by workspace or project locator.
 * also adds a join to projects and organizations.
 * usable for any table that has a workspace and project_id column.
 *
 * https://orm.drizzle.team/docs/dynamic-query-building
 */
export function withOwnershipChecking<
  T extends PgSelect,
  TableName extends string,
>({
  query,
  table,
  ctx,
}: {
  query: T;
  table: PgTableWithColumns<{
    name: TableName;
    dialect: "pg";
    schema: undefined;
    // deno-lint-ignore no-explicit-any
    columns: any;
  }>;
  ctx: AppContext;
}) {
  assertHasWorkspace(ctx);
  assertHasLocator(ctx);
  const { workspace, locator } = ctx;

  return query
    .innerJoin(projects, eq(table.project_id, projects.id))
    .innerJoin(organizations, eq(projects.org_id, organizations.id))
    .where(
      or(
        eq(table.workspace, workspace.value),
        and(
          eq(projects.slug, locator.project),
          eq(organizations.slug, locator.org),
        ),
      ),
    );
}
