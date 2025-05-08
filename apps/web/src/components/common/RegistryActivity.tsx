import { useRegistryActivity } from "../../hooks/useRegistryActivity.ts";

interface Props {
  teamSlug?: string;
}

export default function RegistryActivity({ teamSlug }: Props) {
  useRegistryActivity(teamSlug);

  return null;
}
