import { z } from "zod/v3";
import { InternalServerError } from "../../errors.ts";
import { assertHasUser, assertPrincipalIsUser } from "../assertions.ts";
import { createTool } from "../members/api.ts";

// Schema for onboarding answers
const OnboardingAnswersSchema = z.object({
  role: z.string().min(1, "Role is required"),
  company_size: z.string().min(1, "Company size is required"),
  use_case: z.string().min(1, "Use case is required"),
});

export type OnboardingAnswers = z.infer<typeof OnboardingAnswersSchema>;

// Save onboarding answers
export const saveOnboardingAnswers = createTool({
  name: "ONBOARDING_SAVE_ANSWERS",
  description: "Save user onboarding questionnaire answers",
  inputSchema: z.lazy(() => OnboardingAnswersSchema),
  handler: async ({ role, company_size, use_case }, c) => {
    assertPrincipalIsUser(c);
    assertHasUser(c);

    c.resourceAccess.grant();

    const user = c.user;

    // Insert or update onboarding answers
    const { data, error } = await c.db
      .from("deco_chat_onboarding")
      .upsert(
        {
          user_id: user.id,
          role,
          company_size,
          use_case,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      )
      .select()
      .single();

    if (error) {
      console.error("[ONBOARDING] Error saving answers:", error);
      throw new InternalServerError(error.message);
    }

    return data;
  },
});

// Get onboarding status
export const getOnboardingStatus = createTool({
  name: "ONBOARDING_GET_STATUS",
  description:
    "Check if user has completed onboarding questionnaire. Returns { completed, record }.",
  inputSchema: z.lazy(() => z.object({})),
  handler: async (_, c) => {
    assertPrincipalIsUser(c);
    assertHasUser(c);

    c.resourceAccess.grant();

    const user = c.user;

    const { data, error } = await c.db
      .from("deco_chat_onboarding")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[ONBOARDING] Error fetching status:", error);
      throw new InternalServerError(error.message);
    }

    const completed = !!data;
    return {
      completed,
      record: data,
    };
  },
});
