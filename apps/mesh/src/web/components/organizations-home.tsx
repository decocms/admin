import { authClient } from "@/web/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { EntityCard } from "@deco/ui/components/entity-card.tsx";
import { EntityGrid } from "@deco/ui/components/entity-grid.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";

function OrganizationsGrid() {
  const { data: organizations } = authClient.useListOrganizations();
  const navigate = useNavigate();

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
        <div className="text-sm text-muted-foreground text-center">
          No organizations yet. Create your first organization to get started.
        </div>
      </div>
    );
  }

  return (
    <EntityGrid columns={{ sm: 1, md: 2, lg: 3 }}>
      {organizations.map((org) => (
        <EntityCard
          key={org.id}
          onNavigate={() => navigate({ to: "/$org", params: { org: org.slug } })}
        >
          <EntityCard.Header>
            <EntityCard.AvatarSection>
              <EntityCard.Avatar url={org.logo || ""} fallback={org.name} size="lg" objectFit="contain" />
            </EntityCard.AvatarSection>
            <EntityCard.Content>
              <EntityCard.Subtitle>@{org.slug}</EntityCard.Subtitle>
              <EntityCard.Title>{org.name}</EntityCard.Title>
            </EntityCard.Content>
          </EntityCard.Header>
          <EntityCard.Footer>
            <div className="text-xs text-muted-foreground">
              Created: {new Date(org.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </EntityCard.Footer>
        </EntityCard>
      ))}
    </EntityGrid>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <Icon name="error" size={24} className="text-destructive" />
      <div className="text-sm text-muted-foreground text-center">
        Error loading organizations: {error.message}
      </div>
    </div>
  );
}

export function OrganizationsHome() {
  const { error, isPending } = authClient.useListOrganizations();

  if (isPending) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <h2 className="text-3xl font-bold mb-8">Your Organizations</h2>
        <EntityGrid.Skeleton count={6} columns={{ sm: 1, md: 2, lg: 3 }} />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h2 className="text-3xl font-bold mb-8">Your Organizations</h2>
      <Suspense fallback={<EntityGrid.Skeleton count={6} columns={{ sm: 1, md: 2, lg: 3 }} />}>
        <OrganizationsGrid />
      </Suspense>
    </div>
  );
}
