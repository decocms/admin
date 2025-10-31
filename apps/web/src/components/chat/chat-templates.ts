/**
 * Text templates for chat input messages
 */

export const ChatTemplates = {
  screenshot: "Here's a screenshot of the current view:\n\n",
  logs: (logs: string) =>
    `Here are the console logs:\n\n\`\`\`\n${logs}\n\`\`\`\n\n`,
} as const;
