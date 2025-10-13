import { useMemo } from "react";
import { useIntegrationAPIKey, useReissueAPIKey } from "@deco/sdk/hooks";
import type { Statement } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";

interface ReissueApiKeyForIntegrationProps {
  integrationId: string;
  newPolicies: Statement[];
  onReissued?: (result: { id: string; value: string }) => void;
  onCancel?: () => void;
}

function PolicyDisplay({ policy }: { policy: Statement }) {
  const effectColor =
    policy.effect === "allow" ? "text-success" : "text-destructive";
  const effectIcon = policy.effect === "allow" ? "check_circle" : "block";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
      <Icon
        name={effectIcon}
        className={`flex-shrink-0 ${effectColor}`}
        size={20}
      />
      <div className="flex-1">
        <div className="text-sm font-medium capitalize">{policy.effect}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {policy.resource}
        </div>
        {policy.matchCondition && (
          <div className="text-xs text-muted-foreground mt-1">
            Condition: {policy.matchCondition.resource}
          </div>
        )}
      </div>
    </div>
  );
}

function PoliciesSection({
  title,
  policies,
  emptyMessage,
}: {
  title: string;
  policies: Statement[];
  emptyMessage: string;
}) {
  if (!policies || policies.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-2">
        {policies.map((policy, index) => (
          <PolicyDisplay key={index} policy={policy} />
        ))}
      </div>
    </div>
  );
}

export function ReissueApiKeyForIntegration({
  integrationId,
  newPolicies,
  onReissued,
  onCancel,
}: ReissueApiKeyForIntegrationProps) {
  const {
    data: apiKey,
    isLoading,
    error,
  } = useIntegrationAPIKey(integrationId);
  const reissueMutation = useReissueAPIKey();

  const typedApiKey = apiKey as
    | { policies?: Statement[]; [key: string]: unknown }
    | undefined;

  const additionalPolicies = useMemo(() => {
    if (!typedApiKey?.policies || !newPolicies) return newPolicies || [];

    // Ensure policies are arrays and properly typed
    const currentPolicies = (
      Array.isArray(typedApiKey.policies) ? typedApiKey.policies : []
    ) as Statement[];

    // Find policies that are in newPolicies but not in current policies
    const currentPolicyKeys = new Set(
      currentPolicies.map(
        (p) => `${p.effect}:${p.resource}:${p.matchCondition?.resource ?? ""}`,
      ),
    );

    return newPolicies.filter(
      (p) =>
        !currentPolicyKeys.has(
          `${p.effect}:${p.resource}:${p.matchCondition?.resource ?? ""}`,
        ),
    );
  }, [typedApiKey?.policies, newPolicies]);

  const handleReissue = async () => {
    const typedApiKey = apiKey as
      | { id: string; policies?: Statement[]; [key: string]: unknown }
      | undefined;
    if (!typedApiKey) return;

    try {
      const existingPolicies = (typedApiKey.policies || []) as Statement[];

      const result = (await reissueMutation.mutateAsync({
        id: typedApiKey.id,
        policies: [...existingPolicies, ...newPolicies],
      })) as { id: string; value?: string; [key: string]: unknown };

      onReissued?.({
        id: result.id,
        value: result.value ?? "",
      });
    } catch (err) {
      console.error("Failed to reissue API key:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Icon name="error" className="h-4 w-4" />
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!apiKey) {
    return (
      <Alert>
        <Icon name="info" className="h-4 w-4" />
        <AlertDescription>API key not found.</AlertDescription>
      </Alert>
    );
  }

  const hasAdditionalPermissions = additionalPolicies.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Update app permissions</h2>
        <p className="text-sm text-muted-foreground">
          You are about to update the permissions for this app.
        </p>
      </div>

      <Separator />

      {hasAdditionalPermissions && (
        <>
          <div className="flex items-center gap-2">
            <Icon name="add_circle" className="text-primary" size={20} />
            <span className="font-semibold text-sm">
              New permissions being requested
            </span>
          </div>

          <PoliciesSection
            title="New permissions"
            policies={additionalPolicies}
            emptyMessage="No new permissions"
          />
        </>
      )}

      {!hasAdditionalPermissions && (
        <Alert>
          <Icon name="info" className="h-4 w-4" />
          <AlertDescription>
            No new permissions are being requested. The app will have the same
            permissions after the update.
          </AlertDescription>
        </Alert>
      )}

      {reissueMutation.error && (
        <Alert variant="destructive">
          <Icon name="error" className="h-4 w-4" />
          <AlertDescription>{reissueMutation.error.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={reissueMutation.isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleReissue}
          disabled={reissueMutation.isPending}
          className="gap-2"
        >
          {reissueMutation.isPending ? (
            <>
              <Spinner />
              Updating...
            </>
          ) : (
            <>
              <Icon name="key" size={16} />
              Update permissions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
