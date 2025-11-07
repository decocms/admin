import { useMemo, useEffect } from "react";
import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { formatFontFamily } from "./font-helpers.ts";

// Popular Google Fonts - curated list
export const POPULAR_GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Ubuntu",
  "Nunito",
  "Playfair Display",
  "Merriweather",
  "PT Sans",
  "Source Sans Pro",
  "Work Sans",
  "Karla",
  "DM Sans",
  "Outfit",
  "Manrope",
  "Space Grotesk",
  "Plus Jakarta Sans",
  "Lexend",
  "Rubik",
  "IBM Plex Sans",
  "Noto Sans",
  "Cabin",
  "Quicksand",
  "Josefin Sans",
  "Archivo",
  "Mulish",
  "Barlow",
] as const;

export type GoogleFont = (typeof POPULAR_GOOGLE_FONTS)[number];

interface GoogleFontsSelectorProps {
  value: string;
  onChange: (fontName: string) => void;
}

export function GoogleFontsSelector({
  value,
  onChange,
}: GoogleFontsSelectorProps) {
  // Load font preview for all fonts - construct single Google Fonts URL
  const fontFaceUrl = useMemo(() => {
    const families = POPULAR_GOOGLE_FONTS.map(
      (font) => `family=${font.replace(/ /g, "+")}:wght@400;500;600;700`,
    ).join("&");
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
  }, []);

  // Load fonts dynamically
  useEffect(() => {
    // Check if fonts link already exists
    const existingLink = document.querySelector(
      'link[data-google-fonts-selector="true"]',
    );

    if (!existingLink) {
      const linkElement = document.createElement("link");
      linkElement.rel = "stylesheet";
      linkElement.href = fontFaceUrl;
      linkElement.setAttribute("data-google-fonts-selector", "true");
      document.head.appendChild(linkElement);

      return () => {
        linkElement.remove();
      };
    }
  }, [fontFaceUrl]);

  return (
    <div className="space-y-4">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-auto py-3 cursor-pointer">
          <SelectValue>
            <span
              className="text-lg font-medium"
              style={{ fontFamily: formatFontFamily(value) }}
            >
              {value}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          {["Default", ...POPULAR_GOOGLE_FONTS].map((font) => (
            <SelectItem
              key={font}
              value={font}
              className="py-3 cursor-pointer hover:bg-accent"
            >
              <div className="flex items-center justify-between w-full gap-3">
                <span
                  className="text-base font-medium"
                  style={{ fontFamily: formatFontFamily(font) }}
                >
                  {font}
                </span>
                {value === font && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
