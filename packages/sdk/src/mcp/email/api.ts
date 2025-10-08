import { DECO_BOTS_DOMAIN } from "../../constants.ts";
import { UserInputError, WellKnownMcpGroups } from "../../index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { impl, WellKnownBindings } from "../bindings/index.ts";

const EMAIL_GROUP = WellKnownMcpGroups.Email;
export const EMAIL_TOOLS = impl(WellKnownBindings.Channel, [
  {
    group: EMAIL_GROUP,
    description: "Sets an email for the current agent",
    handler: async ({ discriminator }, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c, "CHANNELS_JOIN");
      // assert uniqueness

      if (!discriminator.endsWith(DECO_BOTS_DOMAIN)) {
        throw new UserInputError("Invalid discriminator");
      }

      const { count, error } = await c.db
        .from("deco_chat_channels")
        .select("discriminator", { count: "exact", head: true })
        .eq("discriminator", discriminator);

      if (error) {
        throw new Error(error.message);
      }

      if (count && count > 0) {
        throw new Error("Email already exists");
      }
    },
  },
  {
    // do nothing
    group: EMAIL_GROUP,
    description: "Removes an email for the current agent",
    handler: async (_, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c, "CHANNELS_LEAVE");
    },
  },
  {
    group: EMAIL_GROUP,
    description: "List available emails",
    handler: async (_, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c, "CHANNELS_LIST");
      throw new Error("Not implemented");
    },
  },
]);
