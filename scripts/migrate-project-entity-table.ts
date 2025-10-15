// deno-lint-ignore-file
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import process from "node:process";
import { relations } from "../packages/sdk/src/mcp/relations.ts";
import {
  integrations,
  memberRoles,
  members,
  organizations,
  profiles,
  projects,
} from "../packages/sdk/src/mcp/schema.ts";
import { WELL_KNOWN_PLANS } from "../packages/sdk/src/plan.ts";
import { PgTableWithColumns } from "drizzle-orm/pg-core";

export function slugifyForOrg(input: string, salt: string): string {
  // Lowercase and replace all non-alphanumeric with underscores
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      // Collapse multiple underscores
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") +
    "-" +
    salt
  );
}

const db = drizzle(process.env.DATABASE_URL!, { relations });

async function addUserToOrg({
  tx,
  user,
  orgId,
}: {
  tx: typeof db;
  user: typeof profiles.$inferSelect;
  orgId: number;
}) {
  const member = await tx
    .insert(members)
    .values({
      team_id: orgId,
      user_id: user.user_id,
    })
    .returning()
    .then((r) => r[0]);

  await Promise.all(
    [1, 4].map(async (roleId) => {
      const role = await tx
        .insert(memberRoles)
        .values({
          member_id: member.id,
          role_id: roleId,
        })
        .returning()
        .then((r) => r[0]);
    }),
  );

  return member;
}

async function createNewOrgAndProject({
  tx,
  user,
}: {
  tx: typeof db;
  user: typeof profiles.$inferSelect;
}) {
  const salt = crypto.randomUUID().slice(0, 4);
  const newOrg = await tx
    .insert(organizations)
    .values({
      name: `${user.name}'s org`,
      slug: slugifyForOrg(user.email.split("@")[0], salt),
      plan_id: WELL_KNOWN_PLANS.FREE,
    })
    .returning()
    .then((r) => r[0]);

  const newOrgProject = await tx
    .insert(projects)
    .values({
      org_id: newOrg.id,
      slug: "default",
      title: `${newOrg.name} Default project`,
    })
    .returning()
    .then((r) => r[0]);

  await addUserToOrg({
    tx,
    user,
    orgId: newOrg.id,
  });

  return newOrgProject.id;
}

async function addProjectIdToEntity<
  T extends { id: string; workspace: string },
  TableName extends string,
>({
  items,
  table,
}: {
  table: PgTableWithColumns<{
    name: TableName;
    dialect: "pg";
    schema: undefined;
    // deno-lint-ignore no-explicit-any
    columns: any;
  }>;
  items: T[];
}) {
  console.log(
    "[Adding project id] there are",
    items.length,
    "items to migrate",
  );
  let done = 0;

  const orgsWithProblem = new Map<string, any>();

  for (const item of items) {
    await db.transaction(async (tx) => {
      const workspace = item.workspace;
      if (workspace?.startsWith("/shared")) {
        const orgSlug = workspace.slice(1).split("/")[1];

        const orgAndProject = await tx
          .select({
            orgId: organizations.id,
            projectId: projects.id,
            projectSlug: projects.slug,
          })
          .from(organizations)
          .leftJoin(projects, eq(organizations.id, projects.org_id))
          .where(eq(organizations.slug, orgSlug));

        // Case 1: Organization doesn't exist (empty array) -> Delete the entity
        if (orgAndProject.length === 0) {
          console.log(
            `[DELETE] Organization "${orgSlug}" doesn't exist, deleting entity ${item.id}`,
          );
          await tx.delete(table).where(eq(table.id, item.id));
          done++;
          console.log(`Done ${done} / ${items.length}`);
          return;
        }

        // Look for "default" project across all results
        const defaultProject = orgAndProject.find(
          (p) => p.projectSlug === "default",
        );
        let projectId: string;

        // Case 2: Default project exists -> Use it
        if (defaultProject) {
          if (!defaultProject.projectId) {
            throw new Error(
              `Default project found but projectId is null for org "${orgSlug}"`,
            );
          }
          projectId = defaultProject.projectId;
          console.log(
            `[UPDATE] Using existing project "default" (id: ${projectId}) for entity ${item.id}`,
          );
        }
        // Case 3: No default project
        else {
          const firstResult = orgAndProject[0];

          // Case 3a: Org has no projects (projectSlug is null) -> Create default
          if (firstResult.projectSlug === null) {
            console.log(
              `[CREATE] Creating default project for org "${orgSlug}"`,
            );
            const newProject = await tx
              .insert(projects)
              .values({
                org_id: firstResult.orgId,
                slug: "default",
                title: `Default project`,
              })
              .returning()
              .then((r) => r[0]);

            projectId = newProject.id;
            console.log(
              `[CREATE] Created default project with id ${projectId} for org "${orgSlug}"`,
            );
          }
          // Case 3b: Org has projects but no "default" -> Create default
          else {
            console.log(
              `[CREATE] Org "${orgSlug}" has projects [${orgAndProject.map((p) => p.projectSlug).join(", ")}] but no "default", will fallback to the first project`,
            );

            if (!firstResult.projectId) {
              throw new Error(
                `First project found but projectId is null for org "${orgSlug}"`,
              );
            }
            
            projectId = firstResult.projectId;
            console.log(
              `[UPDATE] Using existing project "${firstResult.projectSlug}" (id: ${projectId}) for entity ${item.id}`,
            );
          }
        }

        // Update entity with project_id
        await tx
          .update(table)
          .set({ project_id: projectId })
          .where(eq(table.id, item.id));

        done++;
        console.log(`Done ${done} / ${items.length}`);
      }

      return;

      if (workspace?.startsWith("/users")) {
        const userId = workspace.slice(1).split("/")[1];

        const user = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.user_id, userId))
          .limit(1)
          .then((r) => r[0]);

        if (!user) {
          console.warn(
            "User not found for userId:",
            userId,
            "workspace:",
            workspace,
          );
          return;
        }

        // find org with a personal project
        // and a single member that is the user
        const userOrgs = await tx.query.organizations.findMany({
          where: {
            members: {
              user_id: userId,
              deleted_at: {
                isNull: true,
              },
            },
          },
          with: {
            members: true,
          },
        });

        const userOrgsWithOnlyOneMember = userOrgs.filter(
          (org) => org.members.length === 1,
        );

        // console.log(
        //   "user has",
        //   userOrgsWithOnlyOneMember.length,
        //   "orgs with only one member",
        // );

        const orgsPersonalProjectAndOneMember: {
          org: (typeof userOrgsWithOnlyOneMember)[number];
          project: typeof projects.$inferSelect;
        }[] = [];

        for (const org of userOrgsWithOnlyOneMember) {
          const orgProjects = await tx
            .select()
            .from(projects)
            .where(eq(projects.org_id, org.id));

          const personalOrDefaultProject = orgProjects.find(
            (p) => p.slug === "personal" || p.slug === "default",
          );

          if (!personalOrDefaultProject) {
            console.error(
              "Org",
              org.slug,
              "have no personal project. it have",
              orgProjects.map((p) => p.slug),
            );
            return;
          }

          orgsPersonalProjectAndOneMember.push({
            org,
            project: personalOrDefaultProject,
          });
        }

        if (userOrgs.length === 0) {
          const newOrgProjectId = await createNewOrgAndProject({
            tx,
            user,
          });

          const itemUpdated = await tx
            .update(table)
            .set({ project_id: newOrgProjectId })
            .where(eq(table.id, item.id))
            .returning()
            .then((r) => r[0]);

          console.log("New org and default project created", {
            newOrgProjectId,
            itemUpdated,
          });
          done++;
          console.log(`Done ${done} / ${items.length}`);
          return;
        }

        if (orgsPersonalProjectAndOneMember.length === 0) {
          const newOrgProjectId = await createNewOrgAndProject({
            tx,
            user,
          });

          const itemUpdated = await tx
            .update(table)
            .set({ project_id: newOrgProjectId })
            .where(eq(table.id, item.id))
            .returning()
            .then((r) => r[0]);

          console.log("case is", {
            userId,
            email: user.email,
            orgsPersonalProjectAndOneMember:
              orgsPersonalProjectAndOneMember.map((o) => o.org.slug),
            userOrgsWithOnlyOneMember: userOrgsWithOnlyOneMember.map(
              (o) => o.slug,
            ),
            userOrgs: userOrgs.map((o) => o.slug),
          });

          console.log(
            "New org and default project created",
            newOrgProjectId,
            itemUpdated.id,
          );
          done++;
          console.log(`Done ${done} / ${items.length}`);
          return;
        }

        if (orgsPersonalProjectAndOneMember.length > 1) {
          console.error(
            "User has multiple orgs with only one member and a personal project, skipping",
            userId,
            {
              slugs: orgsPersonalProjectAndOneMember.map((o) => o.org.slug),
            },
          );

          orgsWithProblem.set(userId, {
            slugs: orgsPersonalProjectAndOneMember.map((o) => o.org.slug),
          });
          return;
        }

        const { project } = orgsPersonalProjectAndOneMember[0];

        await tx
          .update(table)
          .set({ project_id: project.id })
          .where(eq(table.id, item.id));

        console.log("Done ok for user id", userId, item.id);
        done++;
        console.log(`Done ${done} / ${items.length}`);
        return;
      }

      console.log("workspace is some weird thing", workspace);
    });
  }

  console.log("orgsWithProblem", orgsWithProblem);
}

async function fixOrgs(orgSlugs: string[]) {
  for (const orgSlug of orgSlugs) {
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1)
      .then((r) => r[0]);

    if (!org) {
      console.error("Org not found", orgSlug);
      continue;
    }

    const orgProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.org_id, org.id));

    const hasDefaultProject = orgProjects.some((p) => p.slug === "default");
    if (hasDefaultProject) {
      console.log(
        "[ORG already fixed] Default project already exists",
        orgSlug,
      );
      continue;
    }

    const defaultProject = await db
      .insert(projects)
      .values({
        org_id: org.id,
        slug: "default",
        title: `${org.name} Default project`,
      })
      .returning()
      .then((r) => r[0]);

    console.log(
      "[ORG FIXED] Default project created with id",
      defaultProject.id,
      orgSlug,
    );
    continue;
  }
}

const integrationsToMigrate = await db
  .select()
  .from(integrations)
  .where(isNull(integrations.project_id));

await addProjectIdToEntity({
  table: integrations,
  items: integrationsToMigrate as { id: string; workspace: string }[],
});

// const orgsWithProblem = {};

// await fixOrgs(Object.keys(orgsWithProblem));

process.exit(0);
