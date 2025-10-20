import type { Integration } from "@deco/sdk";
import { useMarketplaceIntegrations, useRegistryApp } from "@deco/sdk";
import { AppName } from "@deco/sdk/common";
import { Button } from "@deco/ui/components/button.tsx";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useState } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import {
  integrationNeedsApproval,
  useIntegrationInstallState,
} from "../../../hooks/use-integration-install.tsx";
import { useOptionsLoader } from "../../../hooks/use-options-loader.ts";
import { IntegrationIcon } from "../../integrations/common.tsx";
import type { MarketplaceIntegration } from "../../integrations/marketplace";
import {
  ConfirmMarketplaceInstallDialog,
  useOauthModalContext,
  useUIInstallIntegration,
} from "../../integrations/select-connection-dialog.tsx";
import type { OptionItem } from "../index.tsx";

const CONNECT_ACCOUNT_VALUE = "__connect_account__";

interface TypeSelectFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
  typeValue: string;
}

export function TypeSelectField<T extends FieldValues = FieldValues>({
  name,
  description,
  form,
  disabled,
  typeValue,
}: TypeSelectFieldProps<T>) {
  const {
    data: options,
    isPending,
    refetch: refetchOptions,
  } = useOptionsLoader(typeValue);
  const { onOpenOauthModal } = useOauthModalContext();
  const { data: marketplace } = useMarketplaceIntegrations();
  const [installingIntegration, setInstallingIntegration] =
    useState<MarketplaceIntegration | null>(null);
  const { data: app } = useRegistryApp({ app: typeValue, mode: "sync" });

  // Get integration state to check if we need to show dialog or install directly
  const integrationState = useIntegrationInstallState(typeValue);

  const selectedOption = options.find(
    // oxlint-disable-next-line no-explicit-any
    (option: OptionItem) => option.value === form.getValues(name as any)?.value,
  );

  const handleAddIntegration = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    // TODO: handle type for contracts

    // Find the integration from marketplace based on typeValue
    const integration = app
      ? {
          ...app,
          name: AppName.build(app.scopeName, app.name),
          provider: "marketplace",
        }
      : marketplace?.integrations.find(
          (integration) => integration.name === typeValue,
        );

    if (!integration) return;
    // Check if we should install directly (no schema or empty scopes)
    const needsApproval = integrationNeedsApproval(integrationState);

    // If no schema exists or scopes are empty, install directly
    if (!needsApproval) {
      try {
        await install({
          integration,
        });
        return;
      } catch {
        /** empty block */
      }
    }
    // Show dialog for integrations with schema or scopes
    setInstallingIntegration(integration);
  };

  const handleIntegrationInstalled = async ({
    connection,
    authorizeOauthUrl,
  }: {
    connection: Integration;
    authorizeOauthUrl: string | null;
  }) => {
    const refetchOptionsPromise = refetchOptions();
    if (authorizeOauthUrl) {
      const popup = globalThis.open(authorizeOauthUrl, "_blank");
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        onOpenOauthModal?.({
          openIntegrationOnFinish: false,
          open: true,
          url: authorizeOauthUrl,
          integrationName: installingIntegration?.name || "the service",
          connection: connection,
        });
      }
    }
    await refetchOptionsPromise;
    // oxlint-disable-next-line no-explicit-any
    form.setValue(name as FieldPath<T>, { value: connection.id } as any);
    setInstallingIntegration(null);
  };

  // Setup direct install functionality
  const { install, isLoading: isInstallingLoading } = useUIInstallIntegration({
    onConfirm: handleIntegrationInstalled,
    validate: () =>
      Promise.resolve(!integrationNeedsApproval(integrationState)),
  });

  return (
    <>
      <FormField
        control={form.control}
        name={name as unknown as FieldPath<T>}
        render={({ field }) => (
          <FormItem className="space-y-2">
            <div className="flex items-center gap-4">
              {options?.length > 0 ? (
                <Select
                  onValueChange={(value: string) => {
                    if (value === CONNECT_ACCOUNT_VALUE) {
                      field.onChange({ value: "" });
                      handleAddIntegration();
                      return;
                    }

                    // Update the form with an object containing the selected value
                    const selectedOption = options.find(
                      (option: OptionItem) => option.value === value,
                    );
                    if (selectedOption) {
                      field.onChange({ value: selectedOption.value });
                    }
                  }}
                  value={field.value?.value || ""}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue
                        placeholder={
                          isInstallingLoading ? (
                            <>
                              <Spinner />
                              Connecting...
                            </>
                          ) : (
                            "Select an integration"
                          )
                        }
                      >
                        {field.value?.value && selectedOption && (
                          <div className="flex items-center gap-3 max-w-50">
                            <IntegrationIcon
                              icon={selectedOption.icon}
                              name={selectedOption.label}
                              size="sm"
                              className="flex-shrink-0"
                            />
                            <span className="font-medium truncate min-w-0 flex-1">
                              {selectedOption.label}
                            </span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent align="end" side="bottom">
                    {options.map((option: OptionItem) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-3 max-w-50">
                          <IntegrationIcon
                            icon={option.icon}
                            name={option.label}
                            size="sm"
                            className="flex-shrink-0"
                          />
                          <span className="font-medium text-sm truncate min-w-0 flex-1">
                            {option.label}
                          </span>
                        </div>
                      </SelectItem>
                    ))}

                    <div className="border-t h-px" />
                    <SelectItem
                      key={CONNECT_ACCOUNT_VALUE}
                      value={CONNECT_ACCOUNT_VALUE}
                      disabled={
                        integrationState.isLoading || isInstallingLoading
                      }
                    >
                      <span className="flex items-center justify-center w-8 h-8">
                        {integrationState.isLoading ? (
                          <Spinner />
                        ) : (
                          <Icon name="add" size={24} />
                        )}
                      </span>
                      <span className="font-medium text-sm">
                        Connect new account
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  disabled={
                    isPending ||
                    integrationState.isLoading ||
                    isInstallingLoading
                  }
                  onClick={handleAddIntegration}
                  variant="special"
                >
                  {isInstallingLoading ? (
                    <>
                      <Spinner />
                      Connecting...
                    </>
                  ) : (
                    <>{integrationState.isLoading && <Spinner />} Connect app</>
                  )}
                </Button>
              )}
            </div>
            {description && (
              <FormDescription className="text-xs text-muted-foreground">
                {description}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {installingIntegration && (
        <ConfirmMarketplaceInstallDialog
          integration={installingIntegration}
          setIntegration={setInstallingIntegration}
          onConfirm={handleIntegrationInstalled}
        />
      )}
    </>
  );
}
