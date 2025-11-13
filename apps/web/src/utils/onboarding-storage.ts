/**
 * LocalStorage utilities for onboarding flow persistence
 *
 * Stores and retrieves onboarding parameters across login redirects
 */

const STORAGE_KEY = "decocms-new-project";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export type OnboardingParams = Record<string, string>;

interface StoredOnboardingData {
  params: OnboardingParams;
  timestamp: number;
  expiresIn: number;
}

/**
 * Save onboarding params to localStorage with expiry timestamp
 */
export function saveOnboardingParams(params: OnboardingParams): void {
  try {
    const data: StoredOnboardingData = {
      params,
      timestamp: Date.now(),
      expiresIn: EXPIRY_MS,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save onboarding params:", error);
  }
}

/**
 * Restore onboarding params from localStorage
 * Returns null if not found or expired
 */
export function restoreOnboardingParams(): OnboardingParams | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data: StoredOnboardingData = JSON.parse(stored);
    const now = Date.now();
    const age = now - data.timestamp;

    // Check if expired
    if (age > data.expiresIn) {
      clearOnboardingParams();
      return null;
    }

    return data.params;
  } catch (error) {
    console.error("Failed to restore onboarding params:", error);
    return null;
  }
}

/**
 * Clear onboarding params from localStorage
 */
export function clearOnboardingParams(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear onboarding params:", error);
  }
}

/**
 * Check if there are stored onboarding params (not expired)
 */
export function hasStoredOnboardingParams(): boolean {
  return restoreOnboardingParams() !== null;
}

/**
 * Convert URLSearchParams to OnboardingParams object
 */
export function searchParamsToOnboardingParams(
  searchParams: URLSearchParams,
): OnboardingParams {
  const params: OnboardingParams = {};

  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

/**
 * Convert OnboardingParams object to URLSearchParams
 */
export function onboardingParamsToSearchParams(
  params: OnboardingParams,
): URLSearchParams {
  return new URLSearchParams(params);
}
