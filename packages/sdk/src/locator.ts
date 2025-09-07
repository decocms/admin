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
  adaptToShared: (locator: ProjectLocator): string => {
    const [org] = locator.split("/");
    return `shared/${org}`;
  },
  /**
   * @deprecated We are moving out of /root/slug format
   */
  fromShared: (deprecatedSharedFormatWorkspace: string): ProjectLocator => {
    const [org] = deprecatedSharedFormatWorkspace.split("/");
    return `${org}/default`;
  },
} as const;
