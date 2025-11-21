import { type Integration, useProjects, useFile } from "@deco/sdk";
import { WELL_KNOWN_DECO_OAUTH_INTEGRATIONS } from "@deco/sdk/hooks";
import { type MarketplaceIntegration } from "./marketplace.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { MicroDollar } from "@deco/sdk/mcp/wallet";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { IntegrationIcon } from "./common.tsx";
import {
  type ResolvedDependency,
  useRecursiveDependencies,
} from "../../hooks/use-recursive-dependencies.ts";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { useParams } from "react-router";
import JsonSchemaForm from "../json-schema/index.tsx";
import { generateDefaultValues } from "../json-schema/utils/generate-default-values.ts";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { OAuthCompletionDialog } from "./oauth-completion-dialog.tsx";
import { useIntegrationInstall } from "../../hooks/use-integration-install.tsx";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { toast } from "@deco/ui/components/sonner.tsx";

interface InstallAppDialogProps {
  integration: MarketplaceIntegration | null;
  onClose: () => void;
  onConfirm: (data: {
    authorizeOauthUrl: string | null;
    connection: Integration;
  }) => void;
  isLoading?: boolean;
  onInstall: (formData: Record<string, unknown>) => Promise<void>;
}

export function InstallAppDialog({
  integration,
  onClose,
  onConfirm: _onConfirm,
  isLoading = false,
  onInstall,
}: InstallAppDialogProps) {
  const open = useMemo(() => !!integration, [integration]);
  const {
    dependencies,
    isLoading: depsLoading,
    schema,
  } = useRecursiveDependencies(integration?.name);

  const { org, project: projectParam } = useParams();
  const projects = useProjects({ org: org ?? "" });
  const currentProject = useMemo(
    () => projects.find((project) => project.slug === projectParam),
    [projects, projectParam],
  );
  const { data: resolvedAvatar } = useFile(currentProject?.avatar_url ?? "");

  const [expandedDep, setExpandedDep] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [oauthCompletionDialog, setOauthCompletionDialog] = useState<{
    open: boolean;
    url: string;
    depName: string;
    depFriendlyName: string;
  }>({
    open: false,
    url: "",
    depName: "",
    depFriendlyName: "",
  });
  const [authorizingDep, setAuthorizingDep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { install: installDependency } = useIntegrationInstall();
  const buildWorkspaceUrl = useWorkspaceLink();

  // Helper to check if dependency needs OAuth
  const dependencyNeedsOAuth = (appName: string) => {
    const appNameLower = appName.toLowerCase().replace(/@.*\//, "");
    return WELL_KNOWN_DECO_OAUTH_INTEGRATIONS.includes(appNameLower);
  };

  // Expand first dependency by default
  useEffect(() => {
    if (dependencies.length > 0 && !expandedDep) {
      setExpandedDep(dependencies[0].name);
    }
  }, [dependencies, expandedDep]);

  // Separate app configuration fields from dependencies
  const appConfigSchema = useMemo<JSONSchema7 | null>(() => {
    if (!schema?.properties) return null;

    const appProps: Record<string, JSONSchema7Definition> = {};

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      // Skip dependency properties (those with __type)
      const isDep =
        typeof propSchema === "object" &&
        propSchema.properties?.__type !== undefined;

      if (!isDep) {
        appProps[propName] = propSchema;
      }
    }

    if (Object.keys(appProps).length === 0) return null;

    const requiredFields = schema.required?.filter(
      (field) => field in appProps,
    );

    return {
      type: "object",
      properties: appProps,
      required:
        requiredFields && requiredFields.length > 0
          ? requiredFields
          : undefined,
    } as JSONSchema7;
  }, [schema]);

  // Initialize form with default values
  const defaultValues = useMemo(() => {
    const values: Record<string, unknown> = {};

    // Add dependency selections
    for (const dep of dependencies) {
      if (dep.availableAccounts.length > 0) {
        // Pre-select first available account
        values[dep.name] = {
          __type: dep.appName,
          value: dep.availableAccounts[0].id,
        };
      }
    }

    // Add app config default values
    if (appConfigSchema) {
      const appDefaults = generateDefaultValues(appConfigSchema);
      Object.assign(values, appDefaults);
    }

    return values;
  }, [dependencies, appConfigSchema]);

  const form = useForm<Record<string, unknown>>({
    defaultValues,
  });

  // Reset form when dependencies change
  useEffect(() => {
    if (dependencies.length > 0 || appConfigSchema) {
      form.reset(defaultValues);
    }
  }, [dependencies.length, appConfigSchema, defaultValues, form]);

  // Track scroll to show/hide mask
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateMask = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrollable = scrollHeight > clientHeight;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold

      setShowMask(isScrollable && !isAtBottom);
    };

    updateMask();
    container.addEventListener("scroll", updateMask);

    // Also check on resize
    const resizeObserver = new ResizeObserver(updateMask);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateMask);
      resizeObserver.disconnect();
    };
  }, [dependencies, appConfigSchema]);

  const toggleExpanded = (depName: string) => {
    setExpandedDep((prev: string | null) =>
      prev === depName ? null : depName,
    );
  };

  const contracts = useMemo(
    () => dependencies.filter((dep) => dep.isContract),
    [dependencies],
  );

  const handleAuthorizeDepend = async (dependency: ResolvedDependency) => {
    if (!integration) return;

    setAuthorizingDep(dependency.name);

    try {
      const returnUrl = new URL(
        buildWorkspaceUrl("/apps/success"),
        globalThis.location.origin,
      );

      // Create a marketplace integration object for this dependency
      const depIntegration = {
        id: dependency.appName,
        provider: "deco",
        name: dependency.appName,
        description: dependency.description ?? "",
        icon: dependency.icon ?? "",
        verified: false,
        connection: { type: "HTTP" as const, url: "" },
        friendlyName: dependency.friendlyName ?? dependency.appName,
      };

      const result = await installDependency(
        {
          appId: depIntegration.id,
          appName: depIntegration.name,
          provider: depIntegration.provider,
          returnUrl: returnUrl.href,
        },
        {},
      );

      if (result.redirectUrl) {
        const popup = globalThis.open(result.redirectUrl, "_blank");
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          setOauthCompletionDialog({
            open: true,
            url: result.redirectUrl,
            depName: dependency.name,
            depFriendlyName: dependency.friendlyName ?? dependency.appName,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to authorize ${dependency.friendlyName}:`, error);
      toast.error(
        `Failed to authorize ${dependency.friendlyName ?? dependency.appName}`,
        {
          description:
            error instanceof Error ? error.message : "Please try again",
          action: {
            label: "Retry",
            onClick: () => handleAuthorizeDepend(dependency),
          },
        },
      );
    } finally {
      setAuthorizingDep(null);
    }
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    // Clear previous errors
    setError(null);

    // Validate form before submitting
    const isValid = await form.trigger();
    if (!isValid) {
      // Get first error field and scroll to it
      const errors = form.formState.errors;
      const firstErrorField = Object.keys(errors)[0];

      if (firstErrorField) {
        // Try to find the field element and scroll to it
        const fieldElement = scrollContainerRef.current?.querySelector(
          `[name="${firstErrorField}"]`,
        );
        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      setError("Please fix the validation errors before continuing");
      return;
    }

    try {
      await onInstall(data);
    } catch (err) {
      console.error("Failed to install:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to install app. Please try again.",
      );
    }
  };

  if (!integration) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent
          key={integration?.name || "install-dialog"}
          className="p-0 max-w-[440px] gap-0 h-[calc(100vh-2rem)] md:max-h-[80vh] md:h-auto flex flex-col"
        >
          {/* Header */}
          <DialogHeader className="flex flex-col gap-6 items-center px-6 pt-10 pb-6 shrink-0 border-b border-border">
            <DialogTitle className="sr-only">
              Install {integration.friendlyName ?? integration.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Review and approve permissions for{" "}
              {integration.friendlyName ?? integration.name}
            </DialogDescription>
            <div className="flex gap-2 items-center relative">
              <IntegrationIcon
                icon={integration.icon}
                name={integration.friendlyName ?? integration.name}
                size="xl"
              />
              <div className="bg-background border size-7 flex items-center justify-center border-border rounded-lg p-1 absolute left-1/2 top-5 -translate-x-1/2 z-10">
                <Icon
                  name="sync_alt"
                  size={16}
                  className="text-muted-foreground"
                />
              </div>
              <Avatar
                shape="square"
                url={resolvedAvatar ?? undefined}
                fallback={currentProject?.slug ?? projectParam}
                objectFit="contain"
                size="xl"
              />
            </div>
            <div className="flex flex-col gap-2 w-full">
              <p className="text-xl text-center text-foreground leading-8">
                <span className="font-semibold">
                  {integration.friendlyName ?? integration.name}
                </span>
                {" needs"}
                <br />
                access to the following permissions:
              </p>
            </div>
          </DialogHeader>

          {/* Combined scrollable content */}
          <div
            ref={scrollContainerRef}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto",
              showMask &&
                "mask-[linear-gradient(to_bottom,black_calc(100%-4rem),transparent)]",
            )}
          >
            <FormProvider {...form}>
              <div className="[&>*:first-child]:border-t-0">
                {/* Error banner */}
                {error && (
                  <div className="border-t border-border p-5 bg-destructive/10">
                    <div className="flex items-start gap-3">
                      <Icon
                        name="error"
                        size={20}
                        className="text-destructive shrink-0 mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive mb-1">
                          Error
                        </p>
                        <p className="text-sm text-destructive/90">{error}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setError(null)}
                        className="shrink-0"
                      >
                        <Icon name="close" size={16} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* App configuration fields */}
                {appConfigSchema && (
                  <ConfigSection schema={appConfigSchema} form={form} />
                )}

                {/* Dependencies */}
                {dependencies.length > 0 && (
                  <div className="flex flex-col gap-3 p-5 border-t border-border">
                    {dependencies.map((dep) => (
                      <DependencyItem
                        key={dep.name}
                        dependency={dep}
                        expanded={expandedDep === dep.name}
                        onToggle={() => toggleExpanded(dep.name)}
                        form={form}
                        onAuthorize={handleAuthorizeDepend}
                        isAuthorizing={authorizingDep === dep.name}
                        needsOAuth={dependencyNeedsOAuth(dep.appName)}
                      />
                    ))}
                  </div>
                )}

                {depsLoading && (
                  <div className="flex flex-col gap-3 p-5 border-t border-border">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="bg-background rounded-xl px-2 py-1 flex gap-3 items-center"
                      >
                        <Skeleton className="h-4 w-4 shrink-0" />
                        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-8 w-24 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {!depsLoading &&
                  dependencies.length === 0 &&
                  !appConfigSchema && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 border-t border-border">
                      <Icon
                        name="check_circle"
                        size={48}
                        className="text-success"
                      />
                      <p className="text-sm text-muted-foreground">
                        No dependencies required
                      </p>
                    </div>
                  )}

                {/* Contract Pricing Summary */}
                {contracts.length > 0 && (
                  <ContractPricingSummary contracts={contracts} />
                )}
              </div>
            </FormProvider>
          </div>

          {/* Footer */}
          <DialogFooter className="flex flex-row gap-2.5 justify-end p-5 shrink-0 border-t border-border">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={form.handleSubmit(handleSubmit)}
              disabled={isLoading || depsLoading}
            >
              {isLoading ? "Connecting..." : "Authorize and Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OAuthCompletionDialog
        open={oauthCompletionDialog.open}
        onOpenChange={(open) => {
          setOauthCompletionDialog((prev) => ({ ...prev, open }));
        }}
        authorizeOauthUrl={oauthCompletionDialog.url}
        integrationName={oauthCompletionDialog.depFriendlyName}
      />
    </>
  );
}

interface DependencyItemProps {
  dependency: ResolvedDependency;
  expanded: boolean;
  onToggle: () => void;
  form: UseFormReturn<Record<string, unknown>>;
  onAuthorize?: (dependency: ResolvedDependency) => void;
  isAuthorizing?: boolean;
  needsOAuth?: boolean;
}

function DependencyItem({
  dependency,
  expanded,
  onToggle,
  form,
  onAuthorize,
  isAuthorizing = false,
  needsOAuth = false,
}: DependencyItemProps) {
  const hasPermissions = dependency.permissions.length > 0;
  const hasAccounts = dependency.availableAccounts.length > 0;

  return (
    <div className="flex flex-col">
      {/* Main row */}
      <div
        onClick={() => hasPermissions && onToggle()}
        className={cn(
          "bg-background rounded-xl px-2 py-1 flex gap-3 items-center transition-colors",
          hasPermissions && "hover:bg-accent/50 cursor-pointer",
        )}
      >
        {/* Chevron - only show if has permissions */}
        <div className={cn("shrink-0 w-4", !hasPermissions && "invisible")}>
          <Icon
            name="chevron_right"
            size={16}
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        </div>

        {/* App info */}
        <div className="flex gap-3 items-center flex-1 min-w-0 overflow-hidden">
          <IntegrationIcon
            icon={dependency.icon}
            name={dependency.friendlyName ?? dependency.appName}
            size="sm"
            className="shrink-0"
          />
          <p className="text-sm text-foreground truncate min-w-0">
            {dependency.friendlyName ?? dependency.appName}
            {dependency.isRequired && (
              <span className="text-destructive ml-1">*</span>
            )}
          </p>
        </div>

        {/* Account selector or nothing */}
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {(hasAccounts || needsOAuth) && (
            <Select
              value={
                (form.watch(dependency.name) as { value?: string })?.value ??
                dependency.availableAccounts[0]?.id ??
                "create-new"
              }
              onValueChange={(value) => {
                if (value === "create-new") {
                  onAuthorize?.(dependency);
                  return;
                }
                form.setValue(dependency.name, {
                  __type: dependency.appName,
                  value,
                });
              }}
            >
              <SelectTrigger
                size="sm"
                className="pl-1.5 pr-2 py-4"
                disabled={isAuthorizing}
              >
                <SelectValue>
                  {(() => {
                    if (isAuthorizing) {
                      return <span className="text-xs">Authorizing...</span>;
                    }
                    const selectedId =
                      (form.watch(dependency.name) as { value?: string })
                        ?.value ?? dependency.availableAccounts[0]?.id;
                    if (!selectedId || selectedId === "create-new") {
                      return (
                        <div className="flex items-center gap-2">
                          <Icon name="add" size={14} />
                          <span className="text-xs">Create new account</span>
                        </div>
                      );
                    }
                    const selectedAccount = dependency.availableAccounts.find(
                      (a) => a.id === selectedId,
                    );
                    return selectedAccount ? (
                      <div className="flex items-center gap-2">
                        <IntegrationIcon
                          icon={selectedAccount.icon}
                          name={selectedAccount.name}
                          size="xs"
                        />
                        <span className="truncate">{selectedAccount.name}</span>
                      </div>
                    ) : null;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {dependency.availableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <IntegrationIcon
                        icon={account.icon}
                        name={account.name}
                        size="xs"
                      />
                      <span className="truncate">{account.name}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem
                  key="create-new"
                  value="create-new"
                  className="cursor-pointer"
                  disabled={isAuthorizing}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="add" size={16} className="shrink-0" />
                    <span>Create new account</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Expanded permissions */}
      {hasPermissions && (
        <div
          className={cn(
            "grid transition-all duration-250 ease-in-out-quad",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className={cn(
                "flex px-2 transition-opacity duration-200",
                expanded ? "opacity-80" : "opacity-0",
              )}
            >
              {/* Vertical line aligned with chevron */}
              <div className="w-4 flex justify-center">
                <div className="w-px bg-border" />
              </div>

              {/* Spacing to align with icon (gap-3 from main row) */}
              <div className="w-3" />

              {/* Permissions list */}
              <div className="flex-1 mt-2">
                <div className="flex flex-col">
                  {dependency.permissions.map((permission, index) => (
                    <div
                      key={index}
                      className="bg-background rounded-xl px-0 py-1.5 flex gap-3 items-start"
                    >
                      <div className="w-8 flex items-center justify-center">
                        <Icon
                          name="check"
                          size={16}
                          className="text-success shrink-0"
                        />
                      </div>
                      <div className="flex-1 text-sm text-muted-foreground">
                        {permission.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ConfigSectionProps {
  schema: JSONSchema7;
  form: UseFormReturn<Record<string, unknown>>;
}

function ConfigSection({ schema, form }: ConfigSectionProps) {
  return (
    <div className="border-t border-border p-5">
      <JsonSchemaForm
        schema={schema}
        form={form}
        onSubmit={() => {}}
        submitButton={null}
      />
    </div>
  );
}

interface ContractPricingSummaryProps {
  contracts: ResolvedDependency[];
}

function ContractPricingSummary({ contracts }: ContractPricingSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const allClauses = useMemo(() => {
    const clauses: Array<{
      id: string;
      price: string | number;
      description?: string;
      contractName: string;
    }> = [];

    for (const contract of contracts) {
      if (contract.contractClauses) {
        for (const clause of contract.contractClauses) {
          clauses.push({
            ...clause,
            contractName: contract.friendlyName ?? contract.appName,
          });
        }
      }
    }

    return clauses;
  }, [contracts]);

  if (allClauses.length === 0) return null;

  const formatPrice = (price: string | number): string => {
    if (typeof price === "number") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 6,
      }).format(price);
    }

    try {
      return MicroDollar.from(price).display({
        showAllDecimals: true,
      });
    } catch {
      return `$${price}`;
    }
  };

  return (
    <div className="border-t border-border">
      {/* Collapsible header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon
            name="chevron_right"
            size={16}
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
          <span className="text-sm font-medium">View detailed pricing</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {allClauses.length} {allClauses.length === 1 ? "clause" : "clauses"}
        </span>
      </div>

      {/* Expandable content */}
      <div
        className={cn(
          "grid transition-all duration-250 ease-in-out-quad",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="flex gap-1 flex-col px-6 pb-6">
            {allClauses.map((clause, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{clause.id}</div>
                  {clause.description && (
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {clause.description}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">
                    {formatPrice(clause.price)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
