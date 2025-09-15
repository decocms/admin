import { useRegisterActivity } from "../../hooks/use-register-activity.ts";

interface Props {
  orgSlug?: string;
  projectSlug?: string;
}

export default function RegisterActivity({ orgSlug, projectSlug }: Props) {
  useRegisterActivity(orgSlug, projectSlug);

  return null;
}
