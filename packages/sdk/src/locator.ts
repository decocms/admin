/**
 * a ProjectLocator is a github-like slug string that identifies a project in an organization.
 *
 * format: <org-slug>/<project-slug>
 */

type LocatorStructured = {
  org: string;
  project: string;
};

export type ProjectLocator = `${string}/${string}`;

export const Locator = {
  from({ org, project }: LocatorStructured): ProjectLocator {
    if (org.includes("/") || project.includes("/")) {
      throw new Error("Org or project cannot contain slashes");
    }

    if (org === "shared" || org === "users") {
      console.warn(`Deprecated locator usage detected: ${org}/${project}`);
    }

    return `${org}/${project}` as ProjectLocator;
  },
  parse(locator: ProjectLocator): LocatorStructured {
    if (locator.startsWith("/")) {
      console.warn(
        `Using locator starting with / being ignored. Please remove the leading slash.`,
      );
      locator = locator.slice(1) as ProjectLocator;
    }
    const [org, project] = locator.split("/");
    if (org === "shared" || org === "users") {
      console.warn(`Deprecated locator usage detected: ${org}/${project}`);
    }
    return { org, project };
  },
  /**
   * @deprecated We are moving out of /root/slug format
   */
  adaptToRootSlug: (
    locator: string,
    userId?: string,
  ): `/${string}/${string}` => {
    const normalized = locator.startsWith("/") ? locator.slice(1) : locator;
    const [org, project] = normalized.split("/");

    const usesOldSchema = org === "shared" || org === "users";

    if (usesOldSchema) {
      return `/${org}/${project}`;
    }

    if (project === "personal" && userId) {
      return `/users/${userId}`;
    }

    return `/shared/${org}`;
  },
} as const;
