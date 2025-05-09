import { useRegisterActivity } from "../../hooks/useRegisterActivity.ts";

interface Props {
  teamSlug?: string;
}

export default function RegisterActivity({ teamSlug }: Props) {
  useRegisterActivity(teamSlug);

  return null;
}
