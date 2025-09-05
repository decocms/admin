import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import type { OptionItem } from "../index.tsx";
import { IntegrationIcon } from "../../integrations/common.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useOptionsLoader } from "../../../hooks/use-options-loader.ts";
import { useMarketplaceIntegrations } from "@deco/sdk";
import { ConfirmMarketplaceInstallDialog } from "../../integrations/select-connection-dialog.tsx";
import type { MarketplaceIntegration } from "../../integrations/marketplace";
import { useState } from "react";
import type { Integration } from "@deco/sdk";

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
  title,
  description,
  form,
  isRequired,
  disabled,
  typeValue,
}: TypeSelectFieldProps<T>) {
  const { data: options, isPending } = useOptionsLoader(typeValue);
  const { data: marketplace } = useMarketplaceIntegrations();
  const [installingIntegration, setInstallingIntegration] =
    useState<MarketplaceIntegration | null>(null);

  const selectedOption = options.find(
    // deno-lint-ignore no-explicit-any
    (option: OptionItem) => option.value === form.getValues(name as any)?.value,
  );

  const handleAddIntegration = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // TODO: handle type for contracts

    // Find the integration from marketplace based on typeValue
    const integration = marketplace?.integrations.find(
      (integration) => integration.name === typeValue,
    );

    if (integration) {
      setInstallingIntegration(integration);
    }
  };

  const handleIntegrationSelect = ({
    connection,
  }: {
    connection: Integration;
  }) => {
    // deno-lint-ignore no-explicit-any
    form.setValue(name as FieldPath<T>, { value: connection.id } as any);
    setInstallingIntegration(null);
  };

  return (
    <>
      <FormField
        control={form.control}
        name={name as unknown as FieldPath<T>}
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>
              {title}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <Select
                  onValueChange={(value: string) => {
                    // Update the form with an object containing the selected value
                    const selectedOption = options.find(
                      (option: OptionItem) => option.value === value,
                    );
                    if (selectedOption) {
                      field.onChange({ value: selectedOption.value });
                    }
                  }}
                  defaultValue={field.value?.value}
                  disabled={disabled || isPending}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue
                        placeholder={
                          isPending ? "Loading..." : "Select an integration"
                        }
                      >
                        {field.value?.value && selectedOption && (
                          <div className="flex items-center gap-3">
                            <IntegrationIcon
                              icon={selectedOption.icon}
                              name={selectedOption.label}
                              size="sm"
                            />
                            <span className="font-medium">
                              {selectedOption.label}
                            </span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((option: OptionItem) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="py-3"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <IntegrationIcon
                            icon={option.icon}
                            name={option.label}
                            size="sm"
                            className="flex-shrink-0"
                          />
                          <span className="font-medium text-sm">
                            {option.label}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddIntegration} variant="special">
                  Connect account
                </Button>
              </div>
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

      <ConfirmMarketplaceInstallDialog
        integration={installingIntegration}
        setIntegration={setInstallingIntegration}
        onConfirm={handleIntegrationSelect}
      />
    </>
  );
}
