/**
 * Convert OKLCH color to hex for html2canvas compatibility
 * OKLCH: L (0-1), C (chroma, 0-0.4), H (hue, 0-360)
 */
function oklchToHex(l: number, c: number, h: number, alpha = 1): string {
  // Convert OKLCH to linear RGB
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);

  // OKLab to linear RGB (simplified D65 matrix)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b_ = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Gamma correction
  const gamma = (x: number) => {
    return x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
  };

  r = gamma(Math.max(0, Math.min(1, r)));
  g = gamma(Math.max(0, Math.min(1, g)));
  b_ = gamma(Math.max(0, Math.min(1, b_)));

  // Convert to 8-bit and hex
  const r8 = Math.round(r * 255);
  const g8 = Math.round(g * 255);
  const b8 = Math.round(b_ * 255);

  if (alpha < 1) {
    const a8 = Math.round(alpha * 255);
    return `#${r8.toString(16).padStart(2, "0")}${g8.toString(16).padStart(2, "0")}${b8.toString(16).padStart(2, "0")}${a8.toString(16).padStart(2, "0")}`;
  }

  return `#${r8.toString(16).padStart(2, "0")}${g8.toString(16).padStart(2, "0")}${b8.toString(16).padStart(2, "0")}`;
}

/**
 * Convert all oklch() color functions in a string to hex format
 */
function convertOklchToHex(cssValue: string): string {
  return cssValue.replace(
    /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/g,
    (match, l, c, h, a) => {
      return oklchToHex(
        Number.parseFloat(l),
        Number.parseFloat(c),
        Number.parseFloat(h),
        a ? Number.parseFloat(a) : 1,
      );
    },
  );
}

/**
 * Prepare an iframe document for html2canvas by converting all oklch colors to hex.
 * Returns a cleanup function to restore the original state.
 */
export function prepareIframeForScreenshot(
  iframeDocument: Document,
): () => void {
  const tempStyleId = "html2canvas-color-fix";
  let tempStyle = iframeDocument.getElementById(tempStyleId);

  if (tempStyle) {
    // Already prepared, return no-op cleanup
    return () => {};
  }

  // Create a comprehensive style override
  const cssOverrides: string[] = [];

  // 1. Convert CSS custom properties from :root
  const rootStyle = getComputedStyle(iframeDocument.documentElement);
  const rootOverrides: string[] = [];

  for (let i = 0; i < rootStyle.length; i++) {
    const propName = rootStyle[i];
    if (propName.startsWith("--")) {
      const value = rootStyle.getPropertyValue(propName).trim();
      if (value.includes("oklch(")) {
        try {
          const convertedValue = convertOklchToHex(value);
          rootOverrides.push(`${propName}: ${convertedValue} !important;`);
        } catch (e) {
          console.warn(`Failed to convert ${propName}: ${value}`, e);
        }
      }
    }
  }

  if (rootOverrides.length > 0) {
    cssOverrides.push(`:root { ${rootOverrides.join(" ")} }`);
  }

  // 2. Override all CSS that might use oklch
  // Target common properties that might have oklch colors
  const colorProperties = [
    "color",
    "background-color",
    "border-color",
    "outline-color",
    "text-decoration-color",
    "fill",
    "stroke",
  ];

  // Walk through all elements and check for oklch in computed styles
  const elements = iframeDocument.querySelectorAll("*");
  const elementOverrides: Map<string, string[]> = new Map();

  elements.forEach((element, index) => {
    const style = getComputedStyle(element);
    const overrides: string[] = [];

    colorProperties.forEach((prop) => {
      const value = style.getPropertyValue(prop);
      if (value && value.includes("oklch(")) {
        try {
          const convertedValue = convertOklchToHex(value);
          overrides.push(`${prop}: ${convertedValue} !important;`);
        } catch (e) {
          console.warn(`Failed to convert ${prop} on element ${index}`, e);
        }
      }
    });

    if (overrides.length > 0) {
      // Add a data attribute for targeting
      element.setAttribute("data-color-fix", String(index));
      elementOverrides.set(String(index), overrides);
    }
  });

  // Generate CSS rules for elements with color fixes
  elementOverrides.forEach((overrides, index) => {
    cssOverrides.push(`[data-color-fix="${index}"] { ${overrides.join(" ")} }`);
  });

  if (cssOverrides.length > 0) {
    tempStyle = iframeDocument.createElement("style");
    tempStyle.id = tempStyleId;
    tempStyle.textContent = cssOverrides.join("\n");
    iframeDocument.head.appendChild(tempStyle);
  }

  // Return cleanup function
  return () => {
    const styleToRemove = iframeDocument.getElementById(tempStyleId);
    if (styleToRemove) {
      styleToRemove.remove();
    }

    // Remove data attributes
    iframeDocument.querySelectorAll("[data-color-fix]").forEach((el) => {
      el.removeAttribute("data-color-fix");
    });
  };
}
