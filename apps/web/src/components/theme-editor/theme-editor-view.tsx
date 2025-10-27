import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DEFAULT_THEME,
  THEME_VARIABLES,
  type ThemeVariable,
  useOrgTheme,
  useUpdateOrgTheme,
  type Theme,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Form } from "@deco/ui/components/form.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { ThemePreview } from "./theme-preview.tsx";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";
import { PresetSelector } from "./preset-selector.tsx";
import type { ThemePreset } from "./theme-presets.ts";
import { DetailSection } from "../common/detail-section.tsx";
import { ColorPicker } from "./color-picker.tsx";

interface ThemeEditorFormValues {
  themeVariables?: Partial<Record<ThemeVariable, string>>;
}

// Create enum for strict validation
const ThemeVariableEnum = z.enum([...THEME_VARIABLES] as [
  ThemeVariable,
  ...ThemeVariable[],
]);

const themeEditorSchema = z.object({
  themeVariables: z.record(ThemeVariableEnum, z.string()).optional(),
});

// AI context rules for theme editing
const THEME_EDITOR_AI_RULES = [
  "You are helping the user customize their organization workspace theme. The Theme Editor allows editing organization-level themes that apply to all projects.",
  `Available theme variables and their purposes:
- Brand Colors: Primary brand color (--primary) and its foreground text (--primary-foreground) for buttons and highlights
- Base Colors: Main background (--background) and text color (--foreground) - the foundation of the entire theme
- Interactive Elements: Secondary actions (--secondary), accent highlights (--accent), and their respective text colors
- Cards & Surfaces: Card backgrounds (--card), borders (--border), and input field borders (--input)
- Feedback Colors: Destructive/error (--destructive), success (--success), warning (--warning) states with their text colors
- Sidebar: All sidebar-related colors including background, text, accent, borders, and focus rings
- Layout: Border radius (--radius) and spacing (--spacing) for consistent UI dimensions
- Advanced: Popovers and muted text colors`,
  'Colors should be in OKLCH format (preferred) like "oklch(0.5 0.2 180)" or hex format like "#ff0000". OKLCH provides better color manipulation and perception.',
  "Use THEME_UPDATE_ORG to update the organization-level theme. Do NOT pass orgId - it will be automatically determined from the current workspace context.",
  'To update a theme, only pass the "theme" parameter with the variables you want to change. Example: { "theme": { "variables": { "--primary": "oklch(0.65 0.18 200)", "--radius": "0.5rem" } } }',
  "When suggesting theme changes, consider: contrast ratios for accessibility, color harmony, and the relationship between background/foreground pairs.",
];

interface ColorCardProps {
  variable: {
    key: ThemeVariable;
    value: string;
    isDefault: boolean;
    defaultValue: string;
  };
  onChange: (value: string) => void;
  label: string;
}

function ColorCard({ variable, onChange, label }: ColorCardProps) {
  const displayValue = variable.value || variable.defaultValue;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="aspect-square w-full border border-border rounded-xl p-2 flex items-end justify-center"
        style={{ backgroundColor: displayValue }}
      >
        <ColorPicker value={displayValue} onChange={onChange} />
      </div>
      <p className="text-base font-medium">{label}</p>
    </div>
  );
}

interface OptionCardProps {
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
  preview?: React.ReactNode;
}

function OptionCard({
  label,
  value,
  isActive,
  onClick,
  preview,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`aspect-square w-full border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:border-primary ${
        isActive ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      {preview}
      <p className="text-base font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{value}</p>
    </button>
  );
}

// Color group definitions with proper labels
const COLOR_GROUP_CONFIGS = [
  {
    title: "Primary Theme Colors",
    description: "Customize your workspace colors and branding",
    colors: [
      { key: "--background" as ThemeVariable, label: "Background" },
      { key: "--foreground" as ThemeVariable, label: "Foreground" },
      { key: "--primary" as ThemeVariable, label: "Primary" },
      {
        key: "--primary-foreground" as ThemeVariable,
        label: "Primary Foreground",
      },
    ],
  },
  {
    title: "Secondary & Accent Colors",
    description: "Customize your workspace colors and branding",
    colors: [
      { key: "--secondary" as ThemeVariable, label: "Secondary" },
      {
        key: "--secondary-foreground" as ThemeVariable,
        label: "Secondary Foreground",
      },
      { key: "--accent" as ThemeVariable, label: "Accent" },
      {
        key: "--accent-foreground" as ThemeVariable,
        label: "Accent Foreground",
      },
    ],
  },
  {
    title: "UI Component Colors",
    description: "Customize your workspace colors and branding",
    colors: [
      { key: "--card" as ThemeVariable, label: "Card" },
      { key: "--card-foreground" as ThemeVariable, label: "Card Foreground" },
      { key: "--popover" as ThemeVariable, label: "Popover" },
      {
        key: "--popover-foreground" as ThemeVariable,
        label: "Popover Foreground",
      },
      { key: "--muted" as ThemeVariable, label: "Muted" },
      { key: "--muted-foreground" as ThemeVariable, label: "Muted Foreground" },
    ],
  },
  {
    title: "Utility & Form Colors",
    description: "Customize your workspace colors and branding",
    colors: [
      { key: "--border" as ThemeVariable, label: "Border" },
      { key: "--input" as ThemeVariable, label: "Input" },
      { key: "--ring" as ThemeVariable, label: "Ring" },
    ],
  },
  {
    title: "Status & Feedback Colors",
    description: "Customize your workspace colors and branding",
    colors: [
      { key: "--destructive" as ThemeVariable, label: "Destructive" },
      {
        key: "--destructive-foreground" as ThemeVariable,
        label: "Destructive Foreground",
      },
      { key: "--success" as ThemeVariable, label: "Success" },
      {
        key: "--success-foreground" as ThemeVariable,
        label: "Success Foreground",
      },
      { key: "--warning" as ThemeVariable, label: "Warning" },
      {
        key: "--warning-foreground" as ThemeVariable,
        label: "Warning Foreground",
      },
    ],
  },
  {
    title: "Chart & Visualization Colors",
    description: "Customize your workspace colors and branding",
    colors: [
      { key: "--chart-1" as ThemeVariable, label: "Chart 01" },
      { key: "--chart-2" as ThemeVariable, label: "Chart 02" },
      { key: "--chart-3" as ThemeVariable, label: "Chart 03" },
      { key: "--chart-4" as ThemeVariable, label: "Chart 04" },
      { key: "--chart-5" as ThemeVariable, label: "Chart 05" },
    ],
  },
  {
    title: "Sidebar & Navigation Colors",
    description: "Customize your workspace colors and branding",
    colors: [
      { key: "--sidebar" as ThemeVariable, label: "Sidebar" },
      {
        key: "--sidebar-foreground" as ThemeVariable,
        label: "Sidebar Foreground",
      },
      { key: "--sidebar-accent" as ThemeVariable, label: "Sidebar Accent" },
      {
        key: "--sidebar-accent-foreground" as ThemeVariable,
        label: "Sidebar Accent Foreground",
      },
      { key: "--sidebar-border" as ThemeVariable, label: "Sidebar Border" },
    ],
  },
];

export function ThemeEditorView() {
  const team = useCurrentTeam();
  const [selectedPresetId, setSelectedPresetId] = useState<string>();

  // Fix orgId derivation - team.id might be string
  const orgId = useMemo(() => {
    const parsed = Number(team?.id);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [team?.id]);

  // Fetch org theme
  const { data: orgTheme, isLoading } = useOrgTheme(orgId);

  // Mutation
  const updateOrgThemeMutation = useUpdateOrgTheme();

  const currentTheme = orgTheme;
  const isUpdating = updateOrgThemeMutation.isPending;

  const form = useForm<ThemeEditorFormValues>({
    resolver: zodResolver(themeEditorSchema),
    defaultValues: {
      themeVariables: currentTheme?.variables ?? {},
    },
  });

  // Track previous values for undo functionality
  const previousValuesRef = useRef<Record<string, string>>({});

  // Update form when theme changes
  useEffect(() => {
    form.reset({
      themeVariables: currentTheme?.variables ?? {},
    });
    // IMPORTANT: Only reset undo history when theme changes from external source (save/refetch)
    // NOT when user is actively editing
    previousValuesRef.current = {};
  }, [currentTheme, form]);

  // Cleanup debounce timer on unmount
  const debounceTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Use useWatch instead of form.watch in dependencies
  const themeVariables = useWatch({
    control: form.control,
    name: "themeVariables",
  });

  // Helper to get variable value with fallback
  const getVariableValue = useCallback(
    (key: ThemeVariable) => ({
      key,
      value: String(themeVariables?.[key] || ""),
      isDefault: !themeVariables?.[key],
      defaultValue: DEFAULT_THEME.variables?.[key] || "",
    }),
    [themeVariables],
  );

  // Thread context for AI assistance with theme editing
  const threadContextItems = useMemo<
    Array<
      | { id: string; type: "rule"; text: string }
      | {
          id: string;
          type: "toolset";
          integrationId: string;
          enabledTools: string[];
        }
    >
  >(() => {
    const contextItems: Array<
      | { id: string; type: "rule"; text: string }
      | {
          id: string;
          type: "toolset";
          integrationId: string;
          enabledTools: string[];
        }
    > = THEME_EDITOR_AI_RULES.map((text) => ({
      id: crypto.randomUUID(),
      type: "rule" as const,
      text,
    }));

    // Add theme management toolset
    contextItems.push({
      id: crypto.randomUUID(),
      type: "toolset" as const,
      integrationId: "i:theme-management",
      enabledTools: ["THEME_GET_ORG", "THEME_UPDATE_ORG"],
    });

    // Add HTTP Fetch tool for fetching inspiration/color palettes
    contextItems.push({
      id: crypto.randomUUID(),
      type: "toolset" as const,
      integrationId: "i:http",
      enabledTools: ["HTTP_FETCH"],
    });

    return contextItems;
  }, []);

  useSetThreadContextEffect(threadContextItems);

  const hasChanges = useMemo(() => {
    const currentValues = currentTheme?.variables || {};
    return JSON.stringify(themeVariables) !== JSON.stringify(currentValues);
  }, [themeVariables, currentTheme]);

  const handleVariableChange = useCallback(
    (key: ThemeVariable, newValue: string) => {
      // Store the ORIGINAL saved value from currentTheme only once
      // This way undo always goes back to the saved theme, not the -1 change
      if (!(key in previousValuesRef.current)) {
        const savedValue = currentTheme?.variables?.[key];
        if (savedValue) {
          previousValuesRef.current[key] = savedValue;
        }
      }

      // Immediately apply to CSS for instant visual feedback
      if (newValue) {
        document.documentElement.style.setProperty(key, newValue);
      } else {
        const defaultValue = DEFAULT_THEME.variables?.[key];
        if (defaultValue) {
          document.documentElement.style.setProperty(key, defaultValue);
        }
      }

      // Debounce the form update to reduce re-renders
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        const currentValues = form.getValues("themeVariables");
        const updatedValues = {
          ...currentValues,
          [key]: newValue || undefined,
        };
        form.setValue("themeVariables", updatedValues, { shouldDirty: true });
      }, 100);
    },
    [form, currentTheme],
  );

  async function onSubmit(data: ThemeEditorFormValues) {
    try {
      if (!orgId) {
        toast.error("No organization selected");
        return;
      }

      // Sanitize: filter to only valid ThemeVariable keys with non-empty string values
      const entries = Object.entries(data.themeVariables ?? {}).filter(
        (entry): entry is [ThemeVariable, string] => {
          const [key, value] = entry;
          return (
            (THEME_VARIABLES as readonly string[]).includes(key) &&
            typeof value === "string" &&
            value.length > 0
          );
        },
      );

      const theme: Theme = {
        variables: Object.fromEntries(entries) as Partial<
          Record<ThemeVariable, string>
        >,
      };

      await updateOrgThemeMutation.mutateAsync({ orgId, theme });
      toast.success("Organization theme updated successfully");

      // Dispatch custom event for immediate UI update
      window.dispatchEvent(new CustomEvent("theme-updated"));
    } catch (error) {
      console.error("Failed to update theme:", error);
      toast.error("Failed to update theme");
    }
  }

  function handleSelectPreset(preset: ThemePreset) {
    setSelectedPresetId(preset.id);

    // Apply preset to form
    const presetVariables = preset.theme.variables || {};

    form.setValue("themeVariables", presetVariables, { shouldDirty: true });

    // Apply optimistic updates to CSS variables
    Object.entries(presetVariables).forEach(([key, value]) => {
      if (value) {
        document.documentElement.style.setProperty(key, value);
      }
    });

    toast.success(`Applied ${preset.name} preset`);
  }

  function handleReset() {
    const baseline = currentTheme?.variables ?? {};

    // Re-apply CSS variables to match reset state immediately
    THEME_VARIABLES.forEach((key) => {
      const v =
        (baseline as Record<string, string | undefined>)[key] ??
        DEFAULT_THEME.variables?.[key];
      if (v) {
        document.documentElement.style.setProperty(key, v);
      } else {
        document.documentElement.style.removeProperty(key);
      }
    });

    form.reset({
      themeVariables: baseline,
    });

    // Clear undo history on explicit reset
    previousValuesRef.current = {};

    setSelectedPresetId(undefined);
    toast.success("Changes reset");
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Header Section */}
            <DetailSection>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-medium">Theme Editor</h1>
                  <p className="text-base text-muted-foreground">
                    Customize your colors and branding
                  </p>
                </div>
                {hasChanges && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleReset}
                      disabled={isUpdating}
                      className="h-9 px-3 rounded-xl"
                    >
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      disabled={isUpdating}
                      className="h-9 px-3 rounded-xl"
                    >
                      {isUpdating ? (
                        <>
                          <div className="mr-2">
                            <Spinner />
                          </div>
                          Saving...
                        </>
                      ) : (
                        "Save theme"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </DetailSection>

            {/* Theme Presets Section */}
            <DetailSection
              title="Theme Presets"
              titleSize="h2"
              className="pr-0!"
            >
              <div className="space-y-4">
                <p className="text-base text-muted-foreground">
                  Customize your workspace colors and branding
                </p>
                <PresetSelector
                  onSelectPreset={handleSelectPreset}
                  selectedPresetId={selectedPresetId}
                />
              </div>
            </DetailSection>

            {/* Preview Theme Section */}
            <DetailSection title="Preview theme" titleSize="h2">
              <div className="space-y-4">
                <p className="text-base text-muted-foreground">
                  See how your theme looks
                </p>
                <div>
                  <ThemePreview />
                </div>
              </div>
            </DetailSection>

            {/* Customize Section with Radius, Spacing, and Color Groups */}
            <DetailSection title="Customize" titleSize="h2">
              <div className="space-y-4">
                <p className="text-base text-muted-foreground">
                  Customize your workspace colors and branding
                </p>
                <div className="space-y-10">
                  {/* Border Radius Options */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Border Radius</h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                      {[
                        { label: "Sharp", value: "0rem" },
                        { label: "Default", value: "0.375rem" },
                        { label: "Medium", value: "0.5rem" },
                        { label: "Rounded", value: "0.75rem" },
                      ].map((option) => {
                        const currentRadius =
                          themeVariables?.["--radius"] ||
                          DEFAULT_THEME.variables?.["--radius"];
                        return (
                          <OptionCard
                            key={option.value}
                            label={option.label}
                            value={option.value}
                            isActive={currentRadius === option.value}
                            onClick={() =>
                              handleVariableChange("--radius", option.value)
                            }
                            preview={
                              <div
                                className="w-12 h-12 bg-primary"
                                style={{ borderRadius: option.value }}
                              />
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Spacing Options */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Spacing</h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                      {[
                        { label: "Tight", value: "0.225rem" },
                        { label: "Default", value: "0.25rem" },
                        { label: "Comfortable", value: "0.3rem" },
                      ].map((option) => {
                        const currentSpacing =
                          themeVariables?.["--spacing"] ||
                          DEFAULT_THEME.variables?.["--spacing"];
                        return (
                          <OptionCard
                            key={option.value}
                            label={option.label}
                            value={option.value}
                            isActive={currentSpacing === option.value}
                            onClick={() =>
                              handleVariableChange("--spacing", option.value)
                            }
                            preview={
                              <div className="flex gap-1 items-center justify-center">
                                <div
                                  className="w-3 h-10 bg-primary"
                                  style={{ marginRight: option.value }}
                                />
                                <div
                                  className="w-3 h-10 bg-primary"
                                  style={{ marginRight: option.value }}
                                />
                                <div className="w-3 h-10 bg-primary" />
                              </div>
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Groups */}
                  {COLOR_GROUP_CONFIGS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h3 className="text-lg font-medium">{group.title}</h3>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                        {group.colors.map((color) => (
                          <ColorCard
                            key={color.key}
                            variable={getVariableValue(color.key)}
                            onChange={(value) =>
                              handleVariableChange(color.key, value)
                            }
                            label={color.label}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DetailSection>
          </form>
        </Form>
      </div>
    </div>
  );
}
