/**
 * a ProjectLocator is a github-like slug string that identifies a project in an organization.
 *
 * format: <org-slug>/<project-slug>
 */

export type ProjectLocator = `${string}/${string}`;

export const Locator = {
  from({ org, project }: { org: string; project: string }): ProjectLocator {
    if (org.includes("/") || project.includes("/")) {
      throw new Error("Org or project cannot contain slashes");
    }

    if (org === "shared" || org === "users") {
      console.warn(`Deprecated locator usage detected: ${org}/${project}`);
    }

    return `${org}/${project}` as ProjectLocator;
  },
  parse(locator: ProjectLocator): { org: string; project: string } {
    const [org, project] = locator.split("/");
    if (org === "shared" || org === "users") {
      console.warn(`Deprecated locator usage detected: ${org}/${project}`);
    }
    return { org, project };
  },
  adaptToShared: (locator: ProjectLocator): string => {
    const [org] = locator.split("/");
    return `shared/${org}`;
  },
} as const;
