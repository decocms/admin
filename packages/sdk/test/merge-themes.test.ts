import { mergeThemes } from "../src/mcp/teams/merge-theme.ts";
import { expect, test } from "vitest";

test("mergeThemes - basic merge", () => {
  const currentTheme = {
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
      "--foreground": "#ffffff",
    },
  };

  const newTheme = {
    picture: "https://example.com/picture2.png",
    variables: {
      "--background": "#000000",
    },
  };

  const mergedTheme = mergeThemes(currentTheme, newTheme);

  expect(mergedTheme).toEqual({
    picture: "https://example.com/picture2.png",
    variables: {
      "--background": "#000000",
      "--foreground": "#ffffff",
    },
  });
});

test("mergeThemes - null current theme", () => {
  const newTheme = {
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
  };

  const mergedTheme = mergeThemes(null, newTheme);

  expect(mergedTheme).toEqual({
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
  });
});

test("mergeThemes - undefined new theme", () => {
  const currentTheme = {
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
    font: {
      type: "Google Fonts",
      name: "Inter",
    } as const,
  };

  const mergedTheme = mergeThemes(currentTheme, undefined);

  expect(mergedTheme).toEqual(currentTheme);
});

test("mergeThemes - with Google Font", () => {
  const currentTheme = {
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
    font: {
      type: "Google Fonts",
      name: "Inter",
    } as const,
  };

  const newTheme = {
    picture: "https://example.com/picture2.png",
    variables: {
      "--foreground": "#ffffff",
    },
    font: {
      type: "Google Fonts",
      name: "Roboto",
    } as const,
  };

  const mergedTheme = mergeThemes(currentTheme, newTheme);

  expect(mergedTheme).toEqual({
    picture: "https://example.com/picture2.png",
    variables: {
      "--background": "#000000",
      "--foreground": "#ffffff",
    },
    font: {
      type: "Google Fonts",
      name: "Roboto",
    } as const,
  });
});

test("mergeThemes - with Custom Font", () => {
  const currentTheme = {
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
    font: {
      type: "Custom",
      name: "Custom Font",
      url: "https://example.com/font.ttf",
    } as const,
  };

  const newTheme = {
    picture: "https://example.com/picture2.png",
    variables: {
      "--foreground": "#ffffff",
    },
    font: {
      type: "Custom",
      name: "New Custom Font",
      url: "https://example.com/new-font.ttf",
    } as const,
  };

  const mergedTheme = mergeThemes(currentTheme, newTheme);

  expect(mergedTheme).toEqual({
    picture: "https://example.com/picture2.png",
    variables: {
      "--background": "#000000",
      "--foreground": "#ffffff",
    },
    font: {
      type: "Custom",
      name: "New Custom Font",
      url: "https://example.com/new-font.ttf",
    } as const,
  });
});

test("mergeThemes - invalid current theme", () => {
  const invalidTheme = "not an object";
  const newTheme = {
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
  };

  const mergedTheme = mergeThemes(invalidTheme, newTheme);

  expect(mergedTheme).toEqual({
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
  });
});

test("mergeThemes - remove font with null", () => {
  const currentTheme = {
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
    },
    font: {
      type: "Google Fonts",
      name: "Inter",
    } as const,
  };

  const newTheme = {
    variables: {
      "--foreground": "#ffffff",
    },
    font: null, // Explicitly remove font
  };

  const mergedTheme = mergeThemes(currentTheme, newTheme);

  expect(mergedTheme).toEqual({
    picture: "https://example.com/picture.png",
    variables: {
      "--background": "#000000",
      "--foreground": "#ffffff",
    },
    // font should be removed
  });
  expect(mergedTheme).not.toHaveProperty("font");
});
