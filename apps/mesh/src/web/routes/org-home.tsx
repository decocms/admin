import { useParams } from "@tanstack/react-router";

export default function OrgHome() {
  const { org: orgSlug } = useParams({ from: "/shell/$org" });

  return (
    <div>
      <h1>Org Home</h1>
      <p>Org Slug: {orgSlug}</p>
    </div>
  );
}
