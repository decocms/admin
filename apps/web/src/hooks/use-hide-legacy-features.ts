import { useSDK } from "@deco/sdk";
import { useEffect } from "react";
import { useLocalStorage } from "./use-local-storage.ts";
import { listPrompts, listWorkflowRuns } from "@deco/sdk";

export interface LegacyFeaturesPreferences {
  hideLegacyPrompts: boolean;
  hideLegacyWorkflowRuns: boolean;
  hideLegacyAgents: boolean;
  promptsChecked?: boolean; // Track if we've already checked prompts
  workflowRunsChecked?: boolean; // Track if we've already checked workflow runs
}

const LEGACY_FEATURES_KEY_PREFIX = "legacy-features-preferences";

export function useHideLegacyFeatures() {
  const { locator } = useSDK();
  const storageKey = `${LEGACY_FEATURES_KEY_PREFIX}-${locator.replace(/\//g, "-")}`;

  const { value: preferences, update: setPreferences } =
    useLocalStorage<LegacyFeaturesPreferences>({
      key: storageKey,
      defaultValue: {
        hideLegacyPrompts: false,
        hideLegacyWorkflowRuns: false,
        hideLegacyAgents: false,
        promptsChecked: false,
        workflowRunsChecked: false,
      },
    });

  // Auto-initialize prompts on first load
  useEffect(() => {
    if (!preferences.promptsChecked) {
      listPrompts(locator)
        .then((prompts) => {
          setPreferences({
            ...preferences,
            hideLegacyPrompts: prompts.length <= 2,
            promptsChecked: true,
          });
        })
        .catch((error) => {
          console.error("Failed to fetch prompts for initialization:", error);
          // On error, just mark as checked to avoid infinite retries
          setPreferences({
            ...preferences,
            promptsChecked: true,
          });
        });
    }
  }, [preferences.promptsChecked, locator]);

  // Auto-initialize workflow runs on first load
  useEffect(() => {
    if (!preferences.workflowRunsChecked) {
      listWorkflowRuns(locator, 1, 1)
        .then((response) => {
          // Hide legacy workflow runs if there are no runs
          setPreferences({
            ...preferences,
            hideLegacyWorkflowRuns:
              !response.runs || response.runs.length === 0,
            workflowRunsChecked: true,
          });
        })
        .catch((error) => {
          console.error(
            "Failed to fetch workflow runs for initialization:",
            error,
          );
          // On error, just mark as checked to avoid infinite retries
          setPreferences({
            ...preferences,
            workflowRunsChecked: true,
          });
        });
    }
  }, [preferences.workflowRunsChecked, locator]);

  const toggleLegacyFeature = (feature: keyof LegacyFeaturesPreferences) => {
    setPreferences({
      ...preferences,
      [feature]: !preferences[feature],
    });
  };

  const showLegacyFeature = (feature: keyof LegacyFeaturesPreferences) => {
    return !preferences[feature];
  };

  const hideLegacyFeature = (feature: keyof LegacyFeaturesPreferences) => {
    return preferences[feature];
  };

  return {
    preferences,
    setPreferences,
    toggleLegacyFeature,
    showLegacyFeature,
    hideLegacyFeature,
    isInitialized:
      preferences.promptsChecked && preferences.workflowRunsChecked,
  };
}
