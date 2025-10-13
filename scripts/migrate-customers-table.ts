import { drizzle } from "drizzle-orm/postgres-js";
import { relations } from "../packages/sdk/src/mcp/relations.ts";
import {
  customers,
  organizations,
  profiles,
  projects,
} from "../packages/sdk/src/mcp/schema.ts";
import { isNull, eq } from "drizzle-orm";
import { WELL_KNOWN_PLANS } from "../packages/sdk/src/plan.ts";
import process from "node:process";

const db = drizzle(process.env.DATABASE_URL!, { relations });

const stuff = await db.select().from(customers).where(isNull(customers.org_id));

for (const customer of stuff) {
  console.log(customer.workspace);
  const workspace = customer.workspace;
  if (workspace?.startsWith("/shared")) {
    const orgSlug = workspace.slice(1).split("/")[1];

    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1)
      .then((r) => r[0]);

    await db
      .update(customers)
      .set({ org_id: org.id })
      .where(eq(customers.customer_id, customer.customer_id));
  }

  if (workspace?.startsWith("/users")) {
    const userId = workspace.slice(1).split("/")[1];

    const user = await db
      .select()
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1)
      .then((r) => r[0]);

    // find org with a personal project
    // and a single member that is the user

    const userOrgs = await db.query.organizations.findMany({
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

    console.log("user has", userOrgs.length, "orgs");

    const userOrgsWithOnlyOneMember = userOrgs.filter(
      (org) => org.members.length === 1,
    );

    console.log(
      "user has",
      userOrgsWithOnlyOneMember.length,
      "orgs with only one member",
    );

    const orgsWithOnlyPersonalProject: typeof userOrgs = [];

    for (const org of userOrgsWithOnlyOneMember) {
      console.log("Processing org", org);
      const orgProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.org_id, org.id));

      if (orgProjects.length !== 1) {
        if (orgProjects.length === 0) {
          console.error("Org has no personal project, skipping");
          continue;
        } else {
          throw new Error(
            `Org has multiple projects, user email is ${user.email}`,
          );
        }
      }

      const orgProject = orgProjects[0];

      if (orgProject.slug !== "personal") {
        console.error("Org project's slug is not `personal`, skipping");
        continue;
      }

      orgsWithOnlyPersonalProject.push(org);
    }

    if (orgsWithOnlyPersonalProject.length !== 1) {
      console.log("user email is", user.email);
      console.log("orgsWithOnlyPersonalProject", orgsWithOnlyPersonalProject);
      if (orgsWithOnlyPersonalProject.length === 0) {
        const newOrg = await db
          .insert(organizations)
          .values({
            name: `${user.name}'s org`,
            slug: `${user.name}'s org`,
            plan_id: WELL_KNOWN_PLANS.FREE,
          })
          .returning()
          .then((r) => r[0]);

        const newOrgProject = await db
          .insert(projects)
          .values({
            org_id: newOrg.id,
            slug: "personal",
            title: `${newOrg.name} Personal project`,
          })
          .returning()
          .then((r) => r[0]);

        console.log("New org project created", newOrgProject);

        await db
          .update(customers)
          .set({ org_id: newOrgProject.org_id })
          .where(eq(customers.customer_id, customer.customer_id));

        console.log("Done ok for user id", userId);
        continue;
      } else {
        throw new Error(
          "User has multiple orgs with only one member and a personal project",
        );
      }
    }

    const org = orgsWithOnlyPersonalProject[0];

    await db
      .update(customers)
      .set({ org_id: org.id })
      .where(eq(customers.customer_id, customer.customer_id));
    console.log("Done ok for user id", userId);
  }
}
