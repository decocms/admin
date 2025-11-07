import { useCallback, useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";

type hsl = {
  h: number;
  s: number;
  l: number;
};

type hex = {
  hex: string;
};

type Color = hsl & hex;

function toHex(x: number): string {
  const hex = x.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

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

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  originalValue?: string;
}

export function ColorPicker({ value, onChange, originalValue, label }: ColorPickerProps) {
  // Track if user is actively editing to prevent external updates
  const isEditingRef = useRef<boolean>(false);
  const editingTimeoutRef = useRef<number | undefined>(undefined);

  // User-selected output format
  const [outputFormat, setOutputFormat] = useState<
    "hex" | "oklch" | "hsl" | "rgb"
  >("hex");

  // Initialize from controlled prop
  const [color, setColor] = useState<Color>(() => {
    const hex = parseColorToHex(value)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const hsl = hexToHsl({ hex });
    return { ...hsl, hex };
  });

  const [open, setOpen] = useState(false);

  // Convert hex to the specified output format
  const formatColorOutput = useCallback(
    (
      hex: string,
      format: "hex" | "oklch" | "hsl" | "rgb" = outputFormat,
    ): string => {
      if (format === "oklch") {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        const { l, c, h } = rgbToOklch(r, g, b);
        return `oklch(${l.toFixed(2)} ${c.toFixed(4)} ${h.toFixed(2)})`;
      }

      if (format === "hsl") {
        const hsl = hexToHsl({ hex });
        return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      }

      if (format === "rgb") {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return `rgb(${r}, ${g}, ${b})`;
      }

      return `#${hex}`;
    },
    [outputFormat],
  );

  const [inputValue, setInputValue] = useState(() =>
    formatColorOutput(color.hex),
  );

  // Sync input value with formatted output when not editing
  useEffect(() => {
    if (!isEditingRef.current) {
      setInputValue(formatColorOutput(color.hex));
    }
  }, [color.hex, formatColorOutput]);

  // Update internal state when value prop changes from outside
  useEffect(() => {
    if (isEditingRef.current) return;

    const hex = parseColorToHex(value)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    if (hex !== color.hex && hex.length === 6) {
      const hsl = hexToHsl({ hex });
      setColor({ ...hsl, hex });
    }
  }, [value, color.hex]);

  // Mark as editing and reset timeout
  const markAsEditing = useCallback(() => {
    isEditingRef.current = true;

    if (editingTimeoutRef.current) {
      clearTimeout(editingTimeoutRef.current);
    }

    // Stop marking as editing after 500ms of no changes
    editingTimeoutRef.current = window.setTimeout(() => {
      isEditingRef.current = false;
    }, 500);
  }, []);

  // Cleanup editing timeout on unmount
  useEffect(() => {
    return () => {
      if (editingTimeoutRef.current) {
        clearTimeout(editingTimeoutRef.current);
      }
    };
  }, []);

  const handleColorChange = useCallback(
    (partial: Partial<Color>) => {
      markAsEditing();
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
    },
    [formatColorOutput, onChange, markAsEditing],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      markAsEditing();
      setInputValue(value);

      const hex = parseColorToHex(value)
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
      if (hex.length === 6) {
        const hsl = hexToHsl({ hex });
        setColor({ ...hsl, hex });
        onChange(formatColorOutput(hex));
      }
    },
    [formatColorOutput, onChange, markAsEditing],
  );

  const setColorToOriginalValue = useCallback(() => {
    if (!originalValue) return;
    const hex = parseColorToHex(originalValue)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    if (hex.length === 6) {
      const hsl = hexToHsl({ hex });
      setColor({ ...hsl, hex });
      onChange(originalValue);
      setInputValue(originalValue);
    }
  }, [originalValue, onChange]);

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
                style={{
                  backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)`,
                }}
              />
              <span className="truncate text-sm">{label || value}</span>
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
                markAsEditing();
                const hue = e.target.valueAsNumber;
                setColor((prev) => {
                  const { hex: _hex, ...rest } = { ...prev, h: hue };
                  const hexFormatted = hslToHex({ ...rest });
                  const newColor = { ...rest, hex: hexFormatted };
                  onChange(formatColorOutput(hexFormatted));
                  return newColor;
                });
              }}
            />
            <div className="flex gap-1 w-full">
              <Select
                value={outputFormat}
                onValueChange={(v) => {
                  const newFormat = v as typeof outputFormat;
                  setOutputFormat(newFormat);
                  const formatted = formatColorOutput(color.hex, newFormat);
                  setInputValue(formatted);
                  onChange(formatted);
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hex">HEX</SelectItem>
                  <SelectItem value="hsl">HSL</SelectItem>
                  <SelectItem value="oklch">OKLCH</SelectItem>
                  <SelectItem value="rgb">RGB</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Input
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="pr-[38px]"
                />
                <div className="absolute inset-y-0 right-0 flex h-full items-center px-[5px]">
                  <div
                    className="size-7 rounded-md border border-border"
                    style={{
                      backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)`,
                    }}
                  />
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!originalValue || originalValue === value}
              onClick={() => setColorToOriginalValue()}
            >
              Reset
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
