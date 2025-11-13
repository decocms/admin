import { useCallback } from "react";

// Lists of adjectives and nouns for random name generation
const ADJECTIVES = [
  "swift",
  "bright",
  "clever",
  "bold",
  "quick",
  "happy",
  "calm",
  "brave",
  "gentle",
  "nimble",
  "wise",
  "cosmic",
  "stellar",
  "quantum",
  "atomic",
  "digital",
  "cyber",
  "tech",
  "smart",
  "prime",
  "ultra",
  "mega",
  "super",
  "hyper",
  "epic",
  "grand",
  "royal",
  "noble",
  "elite",
];

const NOUNS = [
  "falcon",
  "tiger",
  "dragon",
  "phoenix",
  "wolf",
  "eagle",
  "lion",
  "panther",
  "hawk",
  "bear",
  "fox",
  "leopard",
  "jaguar",
  "lynx",
  "puma",
  "cheetah",
  "nebula",
  "galaxy",
  "comet",
  "star",
  "nova",
  "pulsar",
  "quasar",
  "cosmos",
  "orbit",
  "atlas",
  "vertex",
  "nexus",
  "apex",
  "matrix",
];

interface UseGenerateProjectNameOptions {
  fallbackName?: string;
}

interface GenerateProjectNameResult {
  generateName: (input?: string) => Promise<string>;
  isGenerating: boolean;
  error: Error | null;
}

/**
 * Hook to generate random project names using adjective + noun pattern
 *
 * @param options - Configuration options
 * @param options.fallbackName - Name to use if generation fails (default: "New Project")
 * @returns Object with generateName function
 *
 * @example
 * const { generateName } = useGenerateProjectName();
 * const name = await generateName(); // Returns something like "Swift Falcon"
 */
export function useGenerateProjectName(
  options: UseGenerateProjectNameOptions = {},
): GenerateProjectNameResult {
  const { fallbackName = "New Project" } = options;

  const generateName = useCallback(
    async (_input?: string): Promise<string> => {
      try {
        // Generate random adjective + noun combination
        const adjective =
          ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

        // Capitalize first letter of each word
        const capitalizedAdjective =
          adjective.charAt(0).toUpperCase() + adjective.slice(1);
        const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1);

        return `${capitalizedAdjective} ${capitalizedNoun}`;
      } catch (err) {
        console.error("Failed to generate project name:", err);
        return fallbackName;
      }
    },
    [fallbackName],
  );

  return {
    generateName,
    isGenerating: false,
    error: null,
  };
}
