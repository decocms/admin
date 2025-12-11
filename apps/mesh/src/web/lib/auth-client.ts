import { createAuthClient } from "better-auth/react";
import {
  organizationClient,
  adminClient,
  magicLinkClient,
} from "better-auth/client/plugins";
import { ssoClient } from "@better-auth/sso/client";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      dynamicAccessControl: {
        enabled: true,
      },
    }),
    adminClient(),
    ssoClient(),
    magicLinkClient(),
  ],
});
