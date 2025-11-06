import { useUserPreferences } from "./use-user-preferences.ts";

type LegacyFeatureKey =
  | "showLegacyPrompts"
  | "showLegacyWorkflowRuns"
  | "showLegacyAgents";

/**
 * Hook to check if legacy features should be shown.
 *
 * Logic:
 * - If the preference value is !== false (i.e., true or undefined), show the legacy feature
 * - Only if the preference value is === false, hide the legacy feature
 * - Default values in localStorage are false (hide), but the logic treats undefined as "show"
 *   to match the requirement that !== false means show
 */
export function useHideLegacyFeatures() {
  const { preferences } = useUserPreferences();

  /**
   * Check if a legacy feature should be shown.
   * Returns true if the feature should be shown, false if it should be hidden.
   *
   * Logic: show if preference !== false
   * - If value === false: hide (explicitly disabled)
   * - If value === true: show (explicitly enabled)
   * - If value === undefined: show (not set, but !== false means show per requirement)
   */
  const showLegacyFeature = (feature: LegacyFeatureKey): boolean => {
    const value = preferences[feature];
    // Only hide if explicitly set to false
    return value !== false;
  };

  const hideLegacyFeature = (feature: LegacyFeatureKey): boolean => {
    return !showLegacyFeature(feature);
  };

  return {
    showLegacyFeature,
    hideLegacyFeature,
  };
}
