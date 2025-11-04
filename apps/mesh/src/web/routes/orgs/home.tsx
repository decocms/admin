import { Link, useParams } from "@tanstack/react-router";

export default function OrgHome() {
  const { org: orgSlug } = useParams({ from: "/shell/$org" });

  return (
    <div>
      <h1>Org Home</h1>
      <p>Org Slug: {orgSlug}</p>
      <div className="flex gap-4">
        <Link to="/$org/members" params={{ org: orgSlug }}>
          Members
        </Link>
        <Link to="/$org/connections" params={{ org: orgSlug }}>
          Connections
        </Link>
      </div>
    </div>
  );
}
