/**
 * a ProjectLocator is a github-like slug string that identifies a project in an organization.
 *
 * format: <org-slug>/<project-slug>
 */

export type LocatorStructured = {
  org: string;
  project: string;
};

export type ProjectLocator = `${string}/${string}`;

const adaptFromRootSlug = (locator: ProjectLocator): ProjectLocator => {
  const [org, project] = locator.split("/");
  if (org === "shared") {
    return Locator.from({ org: project, project: "default" });
  }
  // Known issue: Old workspace /users/$userId format to Locator conversion is not supported.
  // this function only adapts it for /shared teams which are most cases.
  if (org === "users") {
    return locator;
  }
  return locator;
};

export const Locator = {
  asFirstTwoSegmentsOf(path: string): ProjectLocator {
    const normalized = path.startsWith("/") ? path.slice(1) : path;
    const locator = normalized
      .split("/")
      .slice(0, 2)
      .join("/") as ProjectLocator;
    return adaptFromRootSlug(locator);
  },
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
  ): `/users/${string}` | `/shared/${string}` => {
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
