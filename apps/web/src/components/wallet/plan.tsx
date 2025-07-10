import { type Feature, usePlanHasFeature } from "@deco/sdk";

export function Protect(
  { feature, fallback, children }: {
    feature: Feature;
    fallback?: React.ReactNode;
    children: React.ReactNode;
  },
) {
  const hasFeature = usePlanHasFeature(feature);

  if (!hasFeature) {
    return fallback;
  }

  return children;
}
