import { useCallback, useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";

type hsl = {
  h: number;
  s: number;
  l: number;
};

type hex = {
  hex: string;
};

type Color = hsl & hex;

const HashtagIcon = (props: React.ComponentPropsWithoutRef<"svg">) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M11.097 1.515a.75.75 0 0 1 .589.882L10.666 7.5h4.47l1.079-5.397a.75.75 0 1 1 1.47.294L16.665 7.5h3.585a.75.75 0 0 1 0 1.5h-3.885l-1.2 6h3.585a.75.75 0 0 1 0 1.5h-3.885l-1.08 5.397a.75.75 0 1 1-1.47-.294l1.02-5.103h-4.47l-1.08 5.397a.75.75 0 1 1-1.47-.294l1.02-5.103H3.75a.75.75 0 0 1 0-1.5h3.885l1.2-6H5.25a.75.75 0 0 1 0-1.5h3.885l1.08-5.397a.75.75 0 0 1 .882-.588ZM10.365 9l-1.2 6h4.47l1.2-6h-4.47Z"
        clipRule="evenodd"
      />
    </svg>
  );
};

function hslToHex({ h, s, l }: hsl) {
  s /= 100;
  l /= 100;

  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));

  const toHex = (x: number) => {
    const hex = x.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHsl({ hex }: hex): hsl {
  // Ensure the hex string is formatted properly
  hex = hex.replace(/^#/, "");

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Pad with zeros if incomplete
  while (hex.length < 6) {
    hex += "0";
  }

  // Convert hex to RGB
  let r = Number.parseInt(hex.slice(0, 2), 16) || 0;
  let g = Number.parseInt(hex.slice(2, 4), 16) || 0;
  let b = Number.parseInt(hex.slice(4, 6), 16) || 0;

  // Then convert RGB to HSL
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s: number;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
    h *= 360;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// OKLCH to RGB conversion
function oklchToRgb(
  l: number,
  c: number,
  h: number,
): { r: number; g: number; b: number } {
  // Convert OKLCH to OKLab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab to linear RGB
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b_rgb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Convert linear RGB to sRGB
  const toSrgb = (c: number) => {
    const abs = Math.abs(c);
    if (abs > 0.0031308) {
      return (Math.sign(c) || 1) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
    }
    return 12.92 * c;
  };

  r = toSrgb(r);
  g = toSrgb(g);
  b_rgb = toSrgb(b_rgb);

  // Clamp and convert to 0-255
  r = Math.max(0, Math.min(1, r)) * 255;
  g = Math.max(0, Math.min(1, g)) * 255;
  b_rgb = Math.max(0, Math.min(1, b_rgb)) * 255;

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b_rgb) };
}

// RGB to OKLCH conversion
function rgbToOklch(
  r: number,
  g: number,
  b: number,
): { l: number; c: number; h: number } {
  // Convert sRGB to linear RGB
  const toLinear = (c: number) => {
    const abs = c / 255;
    if (abs <= 0.04045) {
      return abs / 12.92;
    }
    return Math.pow((abs + 0.055) / 1.055, 2.4);
  };

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  // Linear RGB to OKLab
  const l_ = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const m_ = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const s_ = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b_lab = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  // OKLab to OKLCH
  const C = Math.sqrt(a * a + b_lab * b_lab);
  let H = (Math.atan2(b_lab, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

// Parse any color format (hex, oklch, hsl, rgb) to hex
function parseColorToHex(color: string): string {
  // Already hex
  if (color.startsWith("#")) {
    return color.replace("#", "");
  }

  // OKLCH format: oklch(L C H) or oklch(L C H / A)
  if (color.startsWith("oklch(")) {
    const match = color.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (match) {
      const l = Number.parseFloat(match[1]);
      const c = Number.parseFloat(match[2]);
      const h = Number.parseFloat(match[3]);
      const { r, g, b } = oklchToRgb(l, c, h);
      const toHex = (x: number) => {
        const hex = x.toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
      };
      return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }
  }

  // HSL format
  if (color.startsWith("hsl(")) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = Number.parseInt(match[1]);
      const s = Number.parseInt(match[2]);
      const l = Number.parseInt(match[3]);
      return hslToHex({ h, s, l });
    }
  }

  // RGB format
  if (color.startsWith("rgb(")) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = Number.parseInt(match[1]);
      const g = Number.parseInt(match[2]);
      const b = Number.parseInt(match[3]);
      const toHex = (x: number) => {
        const hex = x.toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
      };
      return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }
  }

  // Fallback - try to extract hex if it looks like one
  const hexMatch = color.match(/[0-9A-Fa-f]{6}/);
  if (hexMatch) {
    return hexMatch[0].toUpperCase();
  }

  return "000000";
}

const DraggableColorCanvas = ({
  h,
  s,
  l,
  handleChange,
}: hsl & {
  handleChange: (e: Partial<Color>) => void;
}) => {
  const [dragging, setDragging] = useState(false);
  const colorAreaRef = useRef<HTMLDivElement>(null);

  const calculateSaturationAndLightness = useCallback(
    (clientX: number, clientY: number) => {
      if (!colorAreaRef.current) return;
      const rect = colorAreaRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const xClamped = Math.max(0, Math.min(x, rect.width));
      const yClamped = Math.max(0, Math.min(y, rect.height));
      const newSaturation = Math.round((xClamped / rect.width) * 100);
      const newLightness = 100 - Math.round((yClamped / rect.height) * 100);
      handleChange({ s: newSaturation, l: newLightness });
    },
    [handleChange],
  );

  // Mouse event handlers
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      calculateSaturationAndLightness(e.clientX, e.clientY);
    },
    [calculateSaturationAndLightness],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    calculateSaturationAndLightness(e.clientX, e.clientY);
  };

  // Touch event handlers
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        calculateSaturationAndLightness(touch.clientX, touch.clientY);
      }
    },
    [calculateSaturationAndLightness],
  );

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      setDragging(true);
      calculateSaturationAndLightness(touch.clientX, touch.clientY);
    }
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    dragging,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  return (
    <div
      ref={colorAreaRef}
      className="h-48 w-full touch-auto overscroll-none rounded-xl border border-border"
      style={{
        background: `linear-gradient(to top, #000, transparent, #fff), linear-gradient(to left, hsl(${h}, 100%, 50%), #bbb)`,
        position: "relative",
        cursor: "crosshair",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div
        className="color-selector border-4 border-background ring-1 ring-border"
        style={{
          position: "absolute",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: `hsl(${h}, ${s}%, ${l}%)`,
          transform: "translate(-50%, -50%)",
          left: `${s}%`,
          top: `${100 - l}%`,
          cursor: dragging ? "grabbing" : "grab",
        }}
      />
    </div>
  );
};

function sanitizeHex(val: string) {
  const sanitized = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return sanitized;
}

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ColorPicker({
  value,
  onChange,
  label: _label,
}: ColorPickerProps) {
  // Store the original format to maintain it on output
  const [originalFormat, setOriginalFormat] = useState<
    "hex" | "oklch" | "hsl" | "rgb"
  >(() => {
    if (value.startsWith("#")) return "hex";
    if (value.startsWith("oklch(")) return "oklch";
    if (value.startsWith("hsl(")) return "hsl";
    if (value.startsWith("rgb(")) return "rgb";
    return "hex";
  });

  // Initialize from controlled prop
  const [color, setColor] = useState<Color>(() => {
    const hex = sanitizeHex(parseColorToHex(value));
    const hsl = hexToHsl({ hex });
    return { ...hsl, hex };
  });

  const [open, setOpen] = useState(false);

  // Update internal state when value prop changes from outside
  useEffect(() => {
    const hex = sanitizeHex(parseColorToHex(value));
    if (hex !== color.hex && hex.length === 6) {
      const hsl = hexToHsl({ hex });
      setColor({ ...hsl, hex });

      // Update format tracking
      if (value.startsWith("#")) setOriginalFormat("hex");
      else if (value.startsWith("oklch(")) setOriginalFormat("oklch");
      else if (value.startsWith("hsl(")) setOriginalFormat("hsl");
      else if (value.startsWith("rgb(")) setOriginalFormat("rgb");
    }
  }, [value, color.hex]);

  // Convert hex to the appropriate output format
  const formatColorOutput = useCallback(
    (hex: string): string => {
      if (originalFormat === "hex") {
        return `#${hex}`;
      }

      if (originalFormat === "oklch") {
        // Convert hex to RGB then to OKLCH
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        const { l, c, h } = rgbToOklch(r, g, b);
        // Format with proper precision
        return `oklch(${l.toFixed(2)} ${c.toFixed(4)} ${h.toFixed(2)})`;
      }

      if (originalFormat === "hsl") {
        const hsl = hexToHsl({ hex });
        return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      }

      if (originalFormat === "rgb") {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return `rgb(${r}, ${g}, ${b})`;
      }

      return `#${hex}`;
    },
    [originalFormat],
  );

  // Update from hex input
  const handleHexInputChange = (newVal: string) => {
    const hex = sanitizeHex(newVal);
    if (hex.length === 6) {
      const hsl = hexToHsl({ hex });
      setColor({ ...hsl, hex });
      onChange(formatColorOutput(hex));
    } else if (hex.length < 6) {
      setColor((prev) => ({ ...prev, hex }));
    }
  };

  const handleColorChange = (partial: Partial<Color>) => {
    setColor((prev) => {
      const value = { ...prev, ...partial };
      const hexFormatted = hslToHex({
        h: value.h,
        s: value.s,
        l: value.l,
      });
      const newColor = { ...value, hex: hexFormatted };
      onChange(formatColorOutput(hexFormatted));
      return newColor;
    });
  };

  const displayColor = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;

  return (
    <>
      <style
        id="color-picker-slider-thumb-style"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for custom range input styling
        dangerouslySetInnerHTML={{
          __html: `
            input[type='range'].color-picker-hue::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 18px; 
              height: 18px;
              background: transparent;
              border: 4px solid hsl(var(--background));
              box-shadow: 0 0 0 1px hsl(var(--border)); 
              cursor: pointer;
              border-radius: 50%;
            }
            input[type='range'].color-picker-hue::-moz-range-thumb {
              width: 18px;
              height: 18px;
              cursor: pointer;
              border-radius: 50%;
              background: transparent;
              border: 4px solid hsl(var(--background));
              box-shadow: 0 0 0 1px hsl(var(--border));
            }
            input[type='range'].color-picker-hue::-ms-thumb {
              width: 18px;
              height: 18px;
              background: transparent;
              cursor: pointer;
              border-radius: 50%;
              border: 4px solid hsl(var(--background));
              box-shadow: 0 0 0 1px hsl(var(--border));
            }
          `,
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-10 w-full justify-start text-left font-normal"
            type="button"
          >
            <div className="flex items-center gap-2 w-full">
              <div
                className="h-5 w-5 rounded-md border border-border shrink-0"
                style={{ backgroundColor: displayColor }}
              />
              <span className="truncate text-sm">{value}</span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start" side="bottom">
          <div className="flex w-full max-w-[300px] select-none flex-col items-center gap-3 overscroll-none">
            <DraggableColorCanvas {...color} handleChange={handleColorChange} />
            <input
              type="range"
              min="0"
              max="360"
              value={color.h}
              className="color-picker-hue h-3 w-full cursor-pointer appearance-none rounded-full border border-border bg-card"
              style={{
                background: `linear-gradient(to right, 
                  hsl(0, 100%, 50%), 
                  hsl(60, 100%, 50%), 
                  hsl(120, 100%, 50%), 
                  hsl(180, 100%, 50%), 
                  hsl(240, 100%, 50%), 
                  hsl(300, 100%, 50%), 
                  hsl(360, 100%, 50%))`,
              }}
              onChange={(e) => {
                const hue = e.target.valueAsNumber;
                setColor((prev) => {
                  const { hex: _hex, ...rest } = { ...prev, h: hue };
                  const hexFormatted = hslToHex({ ...rest });
                  const newColor = { ...rest, hex: hexFormatted };
                  onChange(`#${hexFormatted}`);
                  return newColor;
                });
              }}
            />
            <div className="relative h-fit w-full">
              <div className="absolute inset-y-0 flex items-center px-[5px]">
                <HashtagIcon className="size-4 text-muted-foreground" />
              </div>
              <Input
                className="pl-[26px] pr-[38px]"
                value={color.hex}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  handleHexInputChange(e.target.value);
                }}
              />
              <div className="absolute inset-y-0 right-0 flex h-full items-center px-[5px]">
                <div
                  className="size-7 rounded-md border border-border"
                  style={{
                    backgroundColor: displayColor,
                  }}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
