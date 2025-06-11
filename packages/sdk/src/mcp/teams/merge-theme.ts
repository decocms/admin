import { Theme } from "../../theme.ts";
import { Json } from "../../storage/index.ts";

export function mergeThemes(
  currentTheme: Json | null,
  newTheme: Theme | undefined,
): Theme | null {
  // If no new theme, return current theme if it's valid
  if (!newTheme) {
    if (
      currentTheme && typeof currentTheme === "object" &&
      !Array.isArray(currentTheme)
    ) {
      const theme = currentTheme as Theme;
      return {
        picture: typeof theme.picture === "string" ? theme.picture : undefined,
        variables:
          typeof theme.variables === "object" && !Array.isArray(theme.variables)
            ? theme.variables
            : undefined,
        font: theme.font,
      };
    }
    return null;
  }

  // Start with current theme if valid
  const merged: Theme = {
    picture: undefined,
    variables: {},
  };

  // Merge current theme if it exists and is valid
  if (
    currentTheme && typeof currentTheme === "object" &&
    !Array.isArray(currentTheme)
  ) {
    const theme = currentTheme as Theme;
    if (typeof theme.picture === "string") {
      merged.picture = theme.picture;
    }
    if (
      typeof theme.variables === "object" && !Array.isArray(theme.variables)
    ) {
      merged.variables = { ...theme.variables };
    }
    if (theme.font) {
      merged.font = theme.font;
    }
  }

  // Merge new theme
  if (newTheme.picture) {
    merged.picture = newTheme.picture;
  }
  if (newTheme.variables) {
    merged.variables = {
      ...merged.variables,
      ...newTheme.variables,
    };
  }
  if (newTheme.font) {
    merged.font = newTheme.font;
  }

  return merged;
}
