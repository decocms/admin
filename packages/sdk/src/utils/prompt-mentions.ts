import { listPrompts } from "../crud/prompts.ts";

interface PromptMention {
  id: string;
}

const MENTION_REGEX =
  /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*><\/span>/g;

/**
 * Extracts prompt mentions from a system prompt
 */
export function extractPromptMentions(systemPrompt: string): PromptMention[] {
  const mentions: PromptMention[] = [];
  let match;

  while ((match = MENTION_REGEX.exec(systemPrompt)) !== null) {
    mentions.push({
      id: match[1],
    });
  }

  return mentions;
}

/**
 * Replaces prompt mentions with their content
 */
export async function replacePromptMentions(
  systemPrompt: string,
  workspace: string,
): Promise<string> {
  const mentions = extractPromptMentions(systemPrompt);
  let result = systemPrompt;

  const prompts = await listPrompts(workspace, {
    ids: mentions.map((mention) => mention.id),
  });

  for (const mention of mentions) {
    try {
      const prompt = prompts.find((prompt) => prompt.id === mention.id);
      result = result.replaceAll(
        `<span data-type="mention" data-id="${mention.id}"></span>`,
        prompt?.content ?? "",
      );
    } catch (error) {
      console.error(`Failed to fetch prompt ${mention.id}:`, error);
      // Keep the original mention if we can't fetch the prompt
    }
  }

  return result;
}
