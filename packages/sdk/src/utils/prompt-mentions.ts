import { listPrompts } from "../crud/prompts.ts";
import type { MCPClient } from "../fetcher.ts";
import { unescapeHTML } from "./html.ts";

interface PromptMention {
  id: string;
}

const MENTION_REGEX =
  /<span\s+data-type="mention"\s+[^>]*?data-id="([^"]+)"[^>]*?>.*?<\/span>/gs;
const PARTIAL_ESCAPED_MENTION_REGEX =
  /&lt;span\s+data-type="mention"\s+[^&]*?data-id="([^"]+)"[^&]*?&gt;.*?&lt;\/span&gt;/gs;
const ESCAPED_MENTION_REGEX =
  /&lt;span\s+data-type=&quot;mention&quot;\s+[^&]*?data-id=&quot;([^&]+)&quot;[^&]*?&gt;.*?&lt;\/span&gt;/gs;

/**
 * Normalizes mentions in a content string
 * @param content - The content string to normalize
 * @returns The normalized content string
 */
export function normalizeMentions(content: string): string {
  const replaceTo = '<span data-type="mention" data-id="$1"></span>';

  return content
    .replaceAll(MENTION_REGEX, replaceTo)
    .replaceAll(PARTIAL_ESCAPED_MENTION_REGEX, replaceTo)
    .replaceAll(ESCAPED_MENTION_REGEX, replaceTo);
}

/**
 * Extracts prompt mentions from a system prompt
 */
export function extractPromptMentions(systemPrompt: string): PromptMention[] {
  const unescapedSystemPrompt = unescapeHTML(systemPrompt);
  const mentions: PromptMention[] = [];
  let match;

  while ((match = MENTION_REGEX.exec(unescapedSystemPrompt)) !== null) {
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
  client?: ReturnType<typeof MCPClient["forWorkspace"]>,
): Promise<string> {
  const mentions = extractPromptMentions(normalizeMentions(systemPrompt));
  let result = systemPrompt;

  if (mentions.length === 0) {
    return result;
  }

  const prompts = await listPrompts(
    workspace,
    {
      ids: mentions.map((mention) => mention.id),
    },
    undefined,
    client,
  ).catch((err) => {
    console.error(err);
    return [];
  });

  for (const mention of mentions) {
    const prompt = prompts.find((prompt) => prompt.id === mention.id);
    result = result.replaceAll(
      `<span data-type="mention" data-id="${mention.id}"></span>`,
      prompt?.content ?? "",
    );
  }

  return unescapeHTML(result);
}
