/**
 * Workspace is a github-like slug string that identifies a project in an organization.
 *
 * format: <org-slug>/<project-slug>
 */

export type Workspace = `${string}/${string}`;

export const Workspaces = {
  from({ org, project }: { org: string; project: string }): Workspace {
    if (org.includes("/") || project.includes("/")) {
      throw new Error("Org or project cannot contain slashes");
    }

    if (org === "shared" || org === "users") {
      console.warn(`Deprecated workspace usage detected: ${org}/${project}`);
    }

    return `${org}/${project}` as Workspace;
  },
  parse(workspace: Workspace): { org: string; project: string } {
    const [org, project] = workspace.split("/");
    if (org === "shared" || org === "users") {
      console.warn(`Deprecated workspace usage detected: ${org}/${project}`);
    }
    return { org, project };
  },
  adaptToShared: (workspace: Workspace): string => {
    const [org] = workspace.split("/");
    return `shared/${org}`;
  },
} as const;
