import { listPrompts } from "../crud/prompts.ts";
import { replacePromptMentions } from "./prompt-mentions.ts";
import type { Agent } from "../models/agent.ts";

/**
 * Processes agent instructions by replacing prompt mentions and appending additional prompts
 */
export async function processAgentInstructions(
  config: Agent,
  workspace: string,
): Promise<string> {
  // First process the main instructions to replace any mention-style prompts
  const processedInstructions = await replacePromptMentions(
    config.instructions,
    workspace,
  );

  // If no additional prompts, return the processed instructions
  if (!config.additional_prompts || config.additional_prompts.length === 0) {
    return processedInstructions;
  }

  // Fetch additional prompts
  const additionalPrompts = await listPrompts(workspace, {
    ids: config.additional_prompts,
  }).catch(() => []);

  // Resolve prompt contents, handling Date/Time Now specially
  const additionalContents = config.additional_prompts
    .map(promptId => {
      const prompt = additionalPrompts.find(p => p.id === promptId);
      if (!prompt) return "";
      
      // Handle Date/Time Now prompt specially
      if (prompt.name === "Date/Time Now") {
        return `Current date and time: ${new Date().toLocaleString()}`;
      }
      
      return prompt.content;
    })
    .filter(Boolean);

  // Combine main instructions with additional prompts
  if (additionalContents.length === 0) {
    return processedInstructions;
  }

  return [processedInstructions, ...additionalContents].join("\n\n");
}