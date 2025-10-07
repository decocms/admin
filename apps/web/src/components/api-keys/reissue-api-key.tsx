import { useMemo } from "react";
import { useIntegrationAPIKey, useReissueAPIKey } from "@deco/sdk/hooks";
import type { ApiKeyPolicies } from "@deco/sdk";
import type { Statement } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";

interface ReissueApiKeyForIntegrationProps {
  integrationId: string;
  newPolicies: ApiKeyPolicies;
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
  const { data: apiKey, isLoading, error } = useIntegrationAPIKey(integrationId);
  const reissueMutation = useReissueAPIKey();

  const additionalPolicies = useMemo(() => {
    if (!apiKey?.policies || !newPolicies) return newPolicies || [];

    // Ensure policies are arrays and properly typed
    const currentPolicies = (
      Array.isArray(apiKey.policies) ? apiKey.policies : []
    ) as Statement[];

    // Find policies that are in newPolicies but not in current policies
    const currentPolicyKeys = new Set(
      currentPolicies.map((p) => `${p.effect}:${p.resource}`),
    );

    return newPolicies.filter(
      (p) => !currentPolicyKeys.has(`${p.effect}:${p.resource}`),
    );
  }, [apiKey?.policies, newPolicies]);

  const handleReissue = async () => {
    if (!apiKey) return;

    try {
      const existingPolicies = (apiKey.policies || []) as Statement[];

      const result = await reissueMutation.mutateAsync({
        id: apiKey.id,
        policies: [...existingPolicies, ...newPolicies],
      });

      onReissued?.({
        id: result.id,
        value: result.value,
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
        <AlertDescription>
          Failed to load API key. Please try again.
        </AlertDescription>
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
      {/* API Key Info */}
      <div>
        <h2 className="text-lg font-semibold mb-1">{apiKey.name}</h2>
        <p className="text-sm text-muted-foreground">
          You are about to reissue this API key
        </p>
      </div>

      <Separator />

      {/* Current Policies */}
      <PoliciesSection
        title="Current Permissions"
        policies={
          (Array.isArray(apiKey.policies) ? apiKey.policies : []) as Statement[]
        }
        emptyMessage="No permissions configured"
      />

      {/* Additional Permissions */}
      {hasAdditionalPermissions && (
        <>
          <div className="flex items-center gap-2">
            <Icon name="add_circle" className="text-primary" size={20} />
            <span className="font-semibold text-sm">
              Additional permissions being requested
            </span>
          </div>

          <PoliciesSection
            title="New Permissions"
            policies={additionalPolicies}
            emptyMessage="No additional permissions"
          />
        </>
      )}

      {!hasAdditionalPermissions && (
        <Alert>
          <Icon name="info" className="h-4 w-4" />
          <AlertDescription>
            No additional permissions are being requested. The key will be
            reissued with the same permissions.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {reissueMutation.error && (
        <Alert variant="destructive">
          <Icon name="error" className="h-4 w-4" />
          <AlertDescription>
            Failed to reissue key: {reissueMutation.error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
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
              Reissuing...
            </>
          ) : (
            <>
              <Icon name="key" size={16} />
              Reissue Key
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
