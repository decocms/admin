import { listPrompts } from "../crud/prompts.ts";

interface PromptMention {
  id: string;
}

const MENTION_REGEX =
  /<span\s+data-type="mention"\s+[^>]*?data-id="([^"]+)"[^>]*?>.*?<\/span>/gs;

/**
 * Normalizes mentions in a content string
 * @param content - The content string to normalize
 * @returns The normalized content string
 */
export function normalizeMentions(content: string): string {
  return content.replaceAll(
    MENTION_REGEX,
    '<span data-type="mention" data-id="$1"></span>',
  );
}

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
  const mentions = extractPromptMentions(normalizeMentions(systemPrompt));
  let result = systemPrompt;

  if (mentions.length === 0) {
    return result;
  }

  const prompts = await listPrompts(workspace, {
    ids: mentions.map((mention) => mention.id),
  }).catch(() => []);

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
