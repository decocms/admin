import {
  autocompleteIntegrations,
  autocompleteTools,
} from "../tools/call-tool.js";

interface CompletionOptions {
  current: string;
  previous: string;
  line: string;
}

/**
 * Generate completions for the call-tool command
 */
async function generateCompletions(options: CompletionOptions): Promise<void> {
  const { current, previous, line } = options;

  try {
    // Parse the command line to understand context
    const words = line.split(/\s+/);
    const commandIndex = words.findIndex((word) => word === "call-tool");

    if (commandIndex === -1) {
      return;
    }

    // Extract arguments and options
    const args = words.slice(commandIndex + 1);
    const integrationIndex = args.findIndex(
      (arg) => arg === "-i" || arg === "--integration",
    );
    const integration =
      integrationIndex !== -1 && integrationIndex + 1 < args.length
        ? args[integrationIndex + 1]
        : undefined;

    let completions: string[] = [];

    // Determine what to complete based on context
    if (previous === "-i" || previous === "--integration") {
      // Complete integration IDs
      completions = await autocompleteIntegrations(current);
    } else if (integration && !current.startsWith("-")) {
      // Complete tool names if we have an integration and current is not an option
      const toolIndex = args.findIndex(
        (arg) => !arg.startsWith("-") && arg !== integration,
      );
      if (toolIndex === -1 || args[toolIndex] === current) {
        completions = await autocompleteTools(current, { integration });
      }
    } else if (!current.startsWith("-") && !integration) {
      // If no integration specified yet, suggest common options
      completions = [
        "-i",
        "--integration",
        "-p",
        "--payload",
        "--set",
        "-w",
        "--workspace",
      ];
    }

    // Output completions (one per line for shell completion)
    completions.forEach((completion) => console.log(completion));
  } catch (error) {
    // Silently fail for completions to avoid breaking shell completion
    console.error("Completion error:", error);
  }
}

/**
 * Main completion command handler
 */
export async function completionCommand(
  type: string,
  options: { current?: string; previous?: string; line?: string },
): Promise<void> {
  if (type === "call-tool") {
    await generateCompletions({
      current: options.current || "",
      previous: options.previous || "",
      line: options.line || "",
    });
  }
}
