import { createAuthClient } from "better-auth/react";
import {
  organizationClient,
  adminClient,
  ssoClient,
  magicLinkClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    adminClient(),
    ssoClient(),
    magicLinkClient(),
  ],
});
