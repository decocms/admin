// System default font stack from global.css
export const DEFAULT_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

/**
 * Formats a font name into a valid CSS font-family value
 * Multi-word fonts get quoted, single-word fonts don't
 */
export function formatFontFamily(fontName: string): string {
  if (fontName === "Default") {
    return DEFAULT_FONT_STACK;
  }
  return fontName.includes(" ")
    ? `"${fontName}", sans-serif`
    : `${fontName}, sans-serif`;
}

/**
 * Constructs a Google Fonts URL for loading a font
 */
export function getGoogleFontUrl(fontName: string): string {
  return `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
}

/**
 * Applies a font to the document
 */
export function applyFontToDocument(fontFamily: string): void {
  document.documentElement.style.setProperty("font-family", fontFamily);
  document.body.style.fontFamily = fontFamily;
}
