import { Navigate, useParams } from "@tanstack/react-router";

export default function OrgHome() {
  const { org: orgSlug } = useParams({ from: "/shell/$org" });
  return <Navigate to="/$org/mcps" params={{ org: orgSlug }} />;
}
