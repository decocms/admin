import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useOnboardingAnswers,
  useOrganizations,
  useSaveOnboardingAnswers,
  useCreateTeam,
  useAutoJoinTeam,
  WELL_KNOWN_EMAIL_DOMAINS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useUser } from "../../hooks/use-user.ts";
import { findThemeByName } from "../theme-editor/theme-presets.ts";

/**
 * Onboarding State Machine
 *
 * Triggers onboarding when:
 * - User has ?initialInput param (starting a chat)
 * - User has no organizations (needs to create one)
 *
 * States:
 * 1. QUESTIONNAIRE - User needs to complete onboarding questions
 * 2. SELECT_ORG - User has orgs and initialInput, needs to select one for project
 * 3. CREATE_ORG - User has no orgs, will auto-create after questionnaire
 * 4. NONE - Not in onboarding flow (has orgs, no initialInput)
 */

// Shared constants
const ROLES = [
  { value: "engineering", label: "Engineering" },
  { value: "product", label: "Product" },
  { value: "marketing", label: "Marketing" },
  { value: "design", label: "Design" },
  { value: "operations", label: "Operations" },
  { value: "sales", label: "Sales" },
  { value: "founder", label: "Founder/Executive" },
  { value: "other", label: "Other" },
];

const COMPANY_SIZES = [
  { value: "1", label: "Just me" },
  { value: "2-25", label: "2-25" },
  { value: "26-100", label: "26-100" },
  { value: "101-500", label: "101-500" },
  { value: "501-1000", label: "501-1000" },
  { value: "1001+", label: "1001+" },
];

const USE_CASES = [
  { value: "internal-apps", label: "Make internal apps" },
  { value: "manage-mcps", label: "Manage MCPs" },
  { value: "ai-saas", label: "Create AI SaaS" },
];

const questionnaireSchema = z.object({
  role: z.string().min(1, "Please select your role"),
  companySize: z.string().min(1, "Please select company size"),
  useCase: z.string().min(1, "Please tell us what you're using deco for"),
});

type QuestionnaireFormData = z.infer<typeof questionnaireSchema>;

// Helper functions
function extractDomain(email: string): string {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1] : "";
}

function domainToCompanyName(domain: string): string {
  if (!domain) return "";
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getLogoUrl(domain: string): string {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
}

function extractUsername(email: string): string {
  const parts = email.split("@");
  return parts.length >= 1 ? parts[0] : "";
}

function generateRandomSuffix(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type OnboardingState =
  | { type: "QUESTIONNAIRE" }
  | { type: "SELECT_ORG" }
  | { type: "CREATE_ORG" }
  | { type: "NONE" };

function deriveOnboardingState(
  hasInitialInput: boolean,
  hasCompletedQuestionnaire: boolean,
  hasOrgs: boolean,
): OnboardingState {
  // User has NO orgs - always show onboarding
  if (!hasOrgs) {
    // Need to complete questionnaire first
    if (!hasCompletedQuestionnaire) {
      return { type: "QUESTIONNAIRE" };
    }
    // Questionnaire done, create org
    return { type: "CREATE_ORG" };
  }

  // User has orgs AND initialInput - onboarding for project creation
  if (hasOrgs && hasInitialInput) {
    // But first, ensure they've completed the questionnaire
    if (!hasCompletedQuestionnaire) {
      return { type: "QUESTIONNAIRE" };
    }
    // Questionnaire done, redirect to org selection
    return { type: "SELECT_ORG" };
  }

  // User has orgs but no initialInput - normal flow
  return { type: "NONE" };
}

/**
 * OnboardingLayout
 *
 * Shared layout for all onboarding screens with capybara background
 */
function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 lg:p-18 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url('https://assets.decocache.com/decocms/cbef38cc-a1fe-4616-bbb6-e928bfe334ef/capybara.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      />
      {/* Green overlay */}
      <div className="absolute inset-0 bg-brand-green-dark/50 backdrop-blur-[2px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * QuestionnaireForm
 *
 * Collects user profile data (role, company size, use case)
 */
function QuestionnaireForm() {
  const saveAnswers = useSaveOnboardingAnswers();

  const form = useForm<QuestionnaireFormData>({
    resolver: zodResolver(questionnaireSchema),
    defaultValues: {
      role: "",
      companySize: "",
      useCase: "",
    },
  });

  async function onSubmit(data: QuestionnaireFormData) {
    await saveAnswers.mutateAsync({
      role: data.role,
      company_size: data.companySize,
      use_case: data.useCase,
    });
    // Reload to let state machine re-evaluate
    window.location.reload();
  }

  return (
    <div className="w-full max-w-2xl flex flex-col gap-10 bg-background backdrop-blur border border-white/20 rounded-2xl p-8">
      {/* Logo */}
      <div className="h-[26px] w-[62px]">
        <img
          src="/img/deco-logo.svg"
          alt="deco"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium text-foreground">
          Tell us more about you
        </h1>
        <p className="text-base text-muted-foreground">
          We just need a few more details to complete your profile.
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6 w-full"
        >
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>What is your role?</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companySize"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>What&apos;s the size of your company?</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="useCase"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>What are you using deco for?</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your use case" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {USE_CASES.map((useCase) => (
                      <SelectItem key={useCase.value} value={useCase.value}>
                        {useCase.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end w-full">
            <Button type="submit" size="lg" disabled={saveAnswers.isPending}>
              Continue
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

/**
 * CreateOrg
 *
 * Automatically creates or joins an organization
 */
function CreateOrg() {
  const [searchParams] = useSearchParams();
  const user = useUser();
  const createTeam = useCreateTeam();
  const autoJoinTeam = useAutoJoinTeam();
  const isCreatingRef = useRef(false);

  const themeParam = searchParams.get("theme");
  const selectedTheme = themeParam ? findThemeByName(themeParam) : undefined;

  const isCreating = createTeam.isPending || autoJoinTeam.isPending;

  useEffect(() => {
    if (isCreating || isCreatingRef.current) return;

    isCreatingRef.current = true;

    async function createOrJoinOrg() {
      const userEmail = user?.email || "";
      const domain = extractDomain(userEmail);
      const isWellKnownDomain = WELL_KNOWN_EMAIL_DOMAINS.has(domain);

      let team;

      try {
        if (isWellKnownDomain) {
          const username = extractUsername(userEmail) || "user";
          const orgName = `${username} personal`;
          const baseSlug = `${username}-personal`;

          try {
            team = await createTeam.mutateAsync({
              name: orgName,
              slug: baseSlug,
              ...(selectedTheme && { theme: selectedTheme }),
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const isSlugError =
              errorMsg.toLowerCase().includes("slug") ||
              errorMsg.toLowerCase().includes("already") ||
              errorMsg.toLowerCase().includes("duplicate");

            if (isSlugError) {
              const randomSlug = `${baseSlug}-${generateRandomSuffix()}`;
              team = await createTeam.mutateAsync({
                name: orgName,
                slug: randomSlug,
                ...(selectedTheme && { theme: selectedTheme }),
              });
            } else {
              throw err;
            }
          }
        } else {
          const orgName = domainToCompanyName(domain) || "My Organization";

          try {
            const result = await autoJoinTeam.mutateAsync(domain);
            if (result.success) {
              team = result.team;
            }
          } catch {
            const baseSlug = nameToSlug(orgName);
            const avatarUrl = getLogoUrl(domain);

            try {
              team = await createTeam.mutateAsync({
                name: orgName,
                slug: baseSlug,
                avatar_url: avatarUrl || undefined,
                domain: domain,
                ...(selectedTheme && { theme: selectedTheme }),
              });
            } catch (createErr) {
              const errorMsg =
                createErr instanceof Error
                  ? createErr.message
                  : String(createErr);
              const isSlugError =
                errorMsg.toLowerCase().includes("slug") ||
                errorMsg.toLowerCase().includes("already") ||
                errorMsg.toLowerCase().includes("duplicate");

              if (isSlugError) {
                const randomSlug = `${baseSlug}-${generateRandomSuffix()}`;
                team = await createTeam.mutateAsync({
                  name: orgName,
                  slug: randomSlug,
                  avatar_url: avatarUrl || undefined,
                  domain: domain,
                  ...(selectedTheme && { theme: selectedTheme }),
                });
              } else {
                throw createErr;
              }
            }
          }
        }

        if (team) {
          location.href = `/${team.slug}/default?${new URLSearchParams(searchParams)}`;
        }
      } catch (error) {
        console.error("Failed to create or join org:", error);
        isCreatingRef.current = false;
      }
    }

    createOrJoinOrg();
  }, [
    user?.email,
    createTeam,
    autoJoinTeam,
    selectedTheme,
    searchParams,
    isCreating,
  ]);

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-lg text-muted">Creating your organization...</p>
    </div>
  );
}

/**
 * SelectOrgRedirect
 *
 * Redirects to org selection page
 */
function SelectOrgRedirect() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const url = new URL("/onboarding/select-org", globalThis.location.origin);
    searchParams.forEach((value, key) => url.searchParams.set(key, value));
    location.href = url.href;
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-lg text-muted">Loading your organizations...</p>
    </div>
  );
}

interface OnboardingStateMachineProps {
  children: React.ReactNode;
}

export function OnboardingStateMachine({
  children,
}: OnboardingStateMachineProps) {
  const [searchParams] = useSearchParams();
  const teams = useOrganizations({});
  const onboardingStatus = useOnboardingAnswers();

  // Check conditions
  const hasInitialInput = searchParams.has("initialInput");
  const hasOrgs = teams.data.length > 0;
  const hasCompletedQuestionnaire = !!onboardingStatus.data?.completed;

  // Derive state from conditions
  const state = useMemo(
    () =>
      deriveOnboardingState(
        hasInitialInput,
        hasCompletedQuestionnaire,
        hasOrgs,
      ),
    [hasInitialInput, hasCompletedQuestionnaire, hasOrgs],
  );

  // Render based on state
  switch (state.type) {
    case "QUESTIONNAIRE":
      return (
        <OnboardingLayout>
          <QuestionnaireForm />
        </OnboardingLayout>
      );

    case "CREATE_ORG":
      return (
        <OnboardingLayout>
          <CreateOrg />
        </OnboardingLayout>
      );

    case "SELECT_ORG":
      return (
        <OnboardingLayout>
          <SelectOrgRedirect />
        </OnboardingLayout>
      );

    case "NONE":
      return <>{children}</>;
  }
}
