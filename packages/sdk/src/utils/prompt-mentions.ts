import { listPrompts } from "../crud/prompts.ts";
import type { MCPClient } from "../fetcher.ts";
import type { Prompt } from "../index.ts";
import { unescapeHTML } from "./html.ts";
import { ProjectLocator } from "../locator.ts";

export const MENTION_REGEX =
  /<span\s+[^>]*data-id=["']?([^"'\s>]+)["']?\s+[^>]*data-mention-type=["']?([^"'\s>]+)["']?[^>]*>.*?<\/span>/g;
export const COMMENT_REGEX =
  /<span\s+data-type="comment"\s*?[^>]*?>.*?<\/span>/gs;

type Mentionables = "prompt" | "tool" | "resource";

const mentionableTypes: Mentionables[] = ["prompt", "tool", "resource"];

interface Mention {
  id: string;
  type: Mentionables;
}

/**
 * Extracts prompt mentions from a system prompt
 */
function extractMentionsFromString(systemPrompt: string): Mention[] {
  const mentions: Mention[] = [];
  let match;

  while ((match = MENTION_REGEX.exec(systemPrompt)) !== null) {
    const type = match[2] as Mentionables;
    if (mentionableTypes.includes(type)) {
      mentions.push({
        type,
        id: match[1],
      });
    }
  }

  return mentions;
}

export function toMention(id: string, type: Mentionables = "prompt") {
  return `<span data-type="mention" data-id=${id} data-mention-type=${type}></span>`;
}

const hasMentions = (content: string) => {
  return content.includes("<span") || content.includes("&lt;span");
};

/**
 * Resolve mentions in content
 * 
 * Note: Currently only resolves prompt mentions. Tool and resource mentions
 * are preserved as-is in the content and handled by the AI model or other systems.
 */
export async function resolveMentions(
  content: string,
  locator: ProjectLocator,
  client?: ReturnType<(typeof MCPClient)["forLocator"]>,
  options?: {
    /**
     * The id of the parent prompt. If provided, the resolution will skip the parent id to avoid infinite recursion.
     */
    parentPromptId?: string;
  },
): Promise<string> {
  if (!hasMentions(content)) {
    return content;
  }

  // Unescape HTML at the beginning to ensure all regex operations work on unescaped content
  const unescapedContent = unescapeHTML(content);

  const contentWithoutComments = unescapedContent.replaceAll(COMMENT_REGEX, "");

  const mentions = extractMentionsFromString(unescapedContent);

  const promptIds = mentions
    .filter((mention) => mention.type === "prompt")
    .map((mention) => mention.id);

  if (!promptIds.length) {
    return contentWithoutComments;
  }

  const prompts = await listPrompts(
    locator,
    {
      ids: promptIds,
      resolveMentions: true,
    },
    undefined,
    client,
  ).catch((err) => {
    console.error(err);
    return [];
  });

  if (!prompts.length) {
    return contentWithoutComments;
  }

  const promptMap = new Map<string, Prompt>(
    prompts.map((prompt) => [prompt.id, prompt]),
  );

  return contentWithoutComments.replaceAll(
    MENTION_REGEX,
    (_match, id, type) => {
      if (type === "prompt") {
        if (id === options?.parentPromptId) {
          return "";
        }

        const prompt = promptMap.get(id);
        if (!prompt) {
          return "";
        }

        return `\n${prompt.content}\n`;
      }

      // For tool and resource mentions, preserve the mention as-is
      // They will be handled by the AI model or other systems
      return _match;
    },
  );
}
