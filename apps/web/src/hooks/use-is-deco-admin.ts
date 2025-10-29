import { DECO_ADMIN_EMAIL_DOMAINS } from "../constants.ts";
import { useUser } from "./use-user.ts";

export function useIsDecoAdmin(): boolean {
  const user = useUser();
  const email = user?.email?.toLowerCase();

  if (!email) return false;

  return DECO_ADMIN_EMAIL_DOMAINS.some((domain) =>
    email.endsWith(`@${domain}`),
  );
}
