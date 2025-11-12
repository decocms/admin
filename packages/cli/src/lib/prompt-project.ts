/**
 * Prompts the user to select a project from an organization.
 */
import inquirer from "inquirer";
import { createWorkspaceClient } from "./mcp.js";
import { readSession } from "./session.js";
// @ts-ignore - does not have types
import inquirerSearchList from "inquirer-search-list";

interface Project {
  id: string;
  slug: string;
  title: string;
  description?: string;
  created_at: string;
}

/**
 * Prompt user to select a project from an organization
 */
export async function promptProject(
  orgSlug: string,
  local = false,
  current = "",
): Promise<Project> {
  // Register the search-list plugin
  try {
    inquirer.registerPrompt("search-list", inquirerSearchList);
  } catch {
    console.warn(
      "Could not load search functionality, falling back to basic list",
    );
  }

  // Check if user has a session
  const session = await readSession();
  if (!session) {
    throw new Error("No session found. Please run 'deco login' first.");
  }

  // Create workspace client with empty workspace to access global tools
  const client = await createWorkspaceClient({
    workspace: "",
    local,
  });

  try {
    // Use PROJECTS_LIST tool to get available projects (requires org parameter)
    const response = await client.callTool({
      name: "PROJECTS_LIST",
      arguments: { org: orgSlug },
    });

    if (response.isError) {
      throw new Error(`Failed to fetch projects: ${response.content}`);
    }

    const { items: projects } = response.structuredContent as {
      items: Project[];
    };

    if (!projects || projects.length === 0) {
      throw new Error(
        `No projects found in organization '${orgSlug}'. Please create a project first.`,
      );
    }

    // Create options for the select component
    const choices = projects.map((project) => ({
      name: `${project.title} (${project.slug})`,
      value: project.slug,
      short: project.slug,
    }));

    // Prompt user to select a project with search functionality
    let selectedSlug: string;

    try {
      // Try using search-list first
      const result = await inquirer.prompt([
        {
          type: "search-list",
          name: "selectedSlug",
          message: "Select a project:",
          choices,
          default: current,
        },
      ]);
      selectedSlug = result.selectedSlug;
    } catch {
      // Fallback to basic list if search-list fails
      const result = await inquirer.prompt([
        {
          type: "list",
          name: "selectedSlug",
          message: "Select a project:",
          choices,
          default: current,
        },
      ]);
      selectedSlug = result.selectedSlug;
    }

    // Find and return the selected project
    const selectedProject = projects.find((p) => p.slug === selectedSlug);
    if (!selectedProject) {
      throw new Error(`Project '${selectedSlug}' not found`);
    }

    return selectedProject;
  } finally {
    // Clean up the client connection
    await client.close();
  }
}
