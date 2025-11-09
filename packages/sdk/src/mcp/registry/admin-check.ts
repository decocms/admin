import { z } from "zod";
import { type AppContext, createToolGroup } from "../context.ts";

/**
 * Checks if a user email belongs to an admin domain
 */
export async function isUserAdmin(
  email: string,
  c: AppContext,
): Promise<boolean> {
  if (!email) return false;

  // Get all admin domains
  const { data: domains, error } = await c.db
    .from("admin_email_domains_deco")
    .select("domain");

  if (error || !domains) {
    return false;
  }

  // Check if user's email ends with any of the admin domains
  return domains.some((row: { domain: string }) => {
    const domainTrimmed = row.domain.trim();
    const emailTrimmed = email.trim();
    return emailTrimmed.endsWith(domainTrimmed);
  });
}

/**
 * Asserts that the current user is an admin, throws error otherwise
 */
export async function assertIsAdmin(c: AppContext): Promise<void> {
  const user = c.user as { email?: string } | undefined;
  if (!user?.email) {
    throw new Error("User not authenticated");
  }

  const isAdmin = await isUserAdmin(user.email, c);
  if (!isAdmin) {
    throw new Error("Unauthorized: Admin access required");
  }
}

/**
 * Tool group for admin verification
 */
const createAdminTool = createToolGroup("Integration", {
  name: "Admin Verification",
  description: "Check admin permissions for store management",
  icon: "https://assets.decocache.com/mcp/09e44283-f47d-4046-955f-816d227c626f/shield.png",
});

/**
 * Public tool to check if current user is admin
 */
export const ADMIN_CHECK = createAdminTool({
  name: "ADMIN_CHECK",
  description: "Check if the current user has admin privileges",
  inputSchema: z.object({}),
  outputSchema: z.object({
    isAdmin: z.boolean().describe("Whether the user is an admin"),
    email: z.string().optional().describe("User's email address"),
  }),
  handler: async (_, c) => {
    // Grant public access to this tool (it's a check, not a modification)
    c.resourceAccess.grant();
    
    const user = c.user as { email?: string } | undefined;
    if (!user?.email) {
      return { isAdmin: false };
    }

    const isAdmin = await isUserAdmin(user.email, c);
    return {
      isAdmin,
      email: user.email,
    };
  },
});
