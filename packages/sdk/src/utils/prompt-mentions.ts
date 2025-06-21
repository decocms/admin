import { listPrompts } from "../crud/prompts.ts";
import { unescapeHTML } from "./html.ts";

// Fixed ID for Date/Time Now prompt (consistent across workspaces)
export const DATETIME_NOW_PROMPT_ID = "datetime-now";

interface PromptMention {
  id: string;
}

const MENTION_REGEX =
  /<span\s+data-type="mention"\s+[^>]*?data-id="([^"]+)"[^>]*?>.*?<\/span>/gs;
const PARTIAL_ESCAPED_MENTION_REGEX =
  /&lt;span\s+data-type="mention"\s+[^&]*?data-id="([^"]+)"[^&]*?&gt;.*?&lt;\/span&gt;/gs;
const ESCAPED_MENTION_REGEX =
  /&lt;span\s+data-type=&quot;mention&quot;\s+[^&]*?data-id=&quot;([^&]+)&quot;[^&]*?&gt;.*?&lt;\/span&gt;/gs;

// Legacy DateTime span regex patterns - keeping for backward compatibility
const DATETIME_REGEX =
  /<span\s*><\/span>/gs;
const PARTIAL_ESCAPED_DATETIME_REGEX =
  /&lt;span\s*&gt;&lt;\/span&gt;/gs;
const ESCAPED_DATETIME_REGEX =
  /&lt;span\s*&gt;&lt;\/span&gt;/gs;

/**
 * Normalizes mentions and legacy datetime spans in a content string
 * @param content - The content string to normalize
 * @returns The normalized content string
 */
export function normalizeMentions(content: string): string {
  const mentionReplaceTo = '<span data-type="mention" data-id="$1"></span>';
  const datetimeReplaceTo = '<span></span>';

  return content
    .replaceAll(MENTION_REGEX, mentionReplaceTo)
    .replaceAll(PARTIAL_ESCAPED_MENTION_REGEX, mentionReplaceTo)
    .replaceAll(ESCAPED_MENTION_REGEX, mentionReplaceTo)
    .replaceAll(DATETIME_REGEX, datetimeReplaceTo)
    .replaceAll(PARTIAL_ESCAPED_DATETIME_REGEX, datetimeReplaceTo)
    .replaceAll(ESCAPED_DATETIME_REGEX, datetimeReplaceTo);
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
 * Replaces datetime spans with current date/time
 */
export function replaceDateTimeSpans(content: string): string {
  const currentDateTime = `Current date and time: ${
    new Date().toLocaleString()
  }`;

  return content.replaceAll(
    '<span></span>',
    currentDateTime,
  );
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

  // First replace datetime spans
  result = replaceDateTimeSpans(result);

  if (mentions.length === 0) {
    return result;
  }

  const prompts = await listPrompts(workspace, {
    ids: mentions.map((mention) => mention.id),
  }).catch(() => []);

  for (const mention of mentions) {
    // Handle Date/Time Now prompt specially
    if (mention.id === DATETIME_NOW_PROMPT_ID) {
      const currentDateTime = `Current date and time: ${new Date().toLocaleString()}`;
      result = result.replaceAll(
        `<span data-type="mention" data-id="${mention.id}"></span>`,
        currentDateTime,
      );
      continue;
    }

    const prompt = prompts.find((prompt) => prompt.id === mention.id);
    result = result.replaceAll(
      `<span data-type="mention" data-id="${mention.id}"></span>`,
      prompt?.content ?? "",
    );
  }

  return unescapeHTML(result);
}
