import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { z } from "zod";
import type { EditorMode } from "@deco/sdk";

const ModeDecisionSchema = z.object({
  mode: z.enum(["ask", "design", "coding", "explore"]),
  reasoning: z.string().describe("Why this mode was chosen"),
  confidence: z.number().min(0).max(1).describe("Confidence in mode selection"),
});

export interface ModeDecisionResult {
  mode: EditorMode;
  reasoning: string;
  confidence: number;
  requiresConfirmation: boolean;
}

export async function decideMode(
  userMessage: string,
  conversationHistory: any[],
  currentMode: EditorMode,
  model: LanguageModel,
): Promise<ModeDecisionResult> {
  console.log("[MODE_DECISION] Starting mode decision", {
    currentMode,
    userMessageLength: userMessage.length,
    historyLength: conversationHistory.length,
  });

  const decisionPrompt = `You are a mode selector for an AI coding editor.

Current mode: ${currentMode}

Available modes:
- ask: Read-only mode for questions and exploration. Can only read resources, cannot create or modify anything.
- design: Can read resources and create/edit design documents (PRDs, specifications). Cannot create tools, workflows, or views.
- coding: Full write access for creating tools, workflows, and views. Can read all resources and execute code.
- explore: Can execute code and discover MCP integrations. Used for testing integrations via code execution.

User message: "${userMessage}"

Analyze the user's intent and decide which mode is most appropriate.
Return your decision as JSON with mode, reasoning, and confidence (0-1).

If the mode is different from current mode, user confirmation will be required.`;

  try {
    console.log("[MODE_DECISION] Calling generateText");
    const result = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: decisionPrompt,
        },
        ...conversationHistory.slice(-5), // Last 5 messages for context
      ],
      maxSteps: 1,
      temperature: 0.3, // Lower temperature for more consistent decisions
    });

    console.log("[MODE_DECISION] generateText completed", {
      textLength: result.text?.length || 0,
      hasText: !!result.text,
    });

    try {
      const response = result.text.trim();
      console.log("[MODE_DECISION] Parsing response", {
        responsePreview: response.substring(0, 200),
      });

      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : response;
      const parsed = JSON.parse(jsonText);
      console.log("[MODE_DECISION] JSON parsed", { parsed });

      const validated = ModeDecisionSchema.parse(parsed);
      console.log("[MODE_DECISION] Schema validated", { validated });

      const decision = {
        mode: validated.mode,
        reasoning: validated.reasoning,
        confidence: validated.confidence,
        requiresConfirmation: currentMode !== validated.mode,
      };

      console.log("[MODE_DECISION] Decision complete", decision);
      return decision;
    } catch (parseError) {
      // Fallback: if parsing fails, stay in current mode
      console.error("[MODE_DECISION] Parsing error", {
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
        stack: parseError instanceof Error ? parseError.stack : undefined,
        responseText: result.text?.substring(0, 500),
      });
      return {
        mode: currentMode,
        reasoning: "Failed to parse mode decision, staying in current mode",
        confidence: 0.5,
        requiresConfirmation: false,
      };
    }
  } catch (error) {
    console.error("[MODE_DECISION] generateText error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Fallback: if generation fails, stay in current mode
    return {
      mode: currentMode,
      reasoning: "Failed to generate mode decision, staying in current mode",
      confidence: 0.5,
      requiresConfirmation: false,
    };
  }
}
