import {
  Suspense,
  useState,
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useOnboardingAnswers,
  useOrganizations,
  useSaveOnboardingAnswers,
  useCreateTeam,
  useAutoJoinTeam,
  useCreateProject,
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
import { Card } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { useUser } from "../../hooks/use-user.ts";
import { findThemeByName } from "../theme-editor/theme-presets.ts";
import {
  restoreOnboardingParams,
  clearOnboardingParams,
  onboardingParamsToSearchParams,
} from "../../utils/onboarding-storage.ts";
import { ErrorBoundary } from "../../error-boundary";
import { OrgAvatars, OrgMemberCount } from "../home/members";

/**
 * Onboarding Page
 *
 * Handles the complete onboarding flow:
 * - Questionnaire (for new users without onboarding data)
 * - Organization creation/joining
 * - Organization selection for project creation
 *
 * States:
 * 1. QUESTIONNAIRE - User needs to complete onboarding questions
 * 2. SELECT_ORG - User has orgs and initialInput, needs to select one for project
 * 3. CREATE_ORG - User has no orgs, will auto-create after questionnaire
 * 4. REDIRECT_HOME - No onboarding needed, redirect to home
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
  | { type: "REDIRECT_HOME" };

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
    // Questionnaire done, show org selection
    return { type: "SELECT_ORG" };
  }

  // User has orgs but no initialInput - redirect to home
  return { type: "REDIRECT_HOME" };
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
          const baseSlug = `${nameToSlug(username)}-personal`;

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
          // Clear onboarding params on success
          clearOnboardingParams();
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
 * OrganizationCard
 *
 * Card component for selecting an organization
 */
function OrganizationCard({
  name,
  slug,
  avatarUrl,
  teamId,
  onSelect,
}: {
  name: string;
  slug: string;
  avatarUrl: string;
  teamId: number;
  onSelect: (slug: string) => void;
}) {
  return (
    <Card className="group transition-all flex flex-col hover:ring-2 hover:ring-primary">
      <button
        type="button"
        onClick={() => onSelect(slug)}
        className="flex flex-col text-left"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <Avatar
              url={avatarUrl}
              fallback={slug}
              size="lg"
              objectFit="contain"
            />
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/80">
                Create here
              </span>
              <div className="w-0 overflow-hidden group-hover:w-5 transition-all">
                <Icon
                  name="chevron_right"
                  size={20}
                  className="text-muted-foreground"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-[2px]">
            <h3 className="text-sm text-muted-foreground truncate">/{slug}</h3>
            <p className="font-medium truncate">{name}</p>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-between items-center">
          <ErrorBoundary fallback={<div className="w-full h-8"></div>}>
            <OrgAvatars teamId={teamId} />
            <OrgMemberCount teamId={teamId} />
          </ErrorBoundary>
        </div>
      </button>
    </Card>
  );
}

/**
 * Organizations
 *
 * Grid of organization cards
 */
function Organizations({
  query,
  onSelectOrg,
}: {
  query?: string;
  onSelectOrg: (slug: string) => void;
}) {
  const teams = useOrganizations({ searchQuery: query });

  if (teams.data?.length === 0) {
    return <Organizations.Empty />;
  }

  return (
    <div className="w-full grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
      {teams.data?.map((team) => (
        <OrganizationCard
          key={team.id}
          name={team.name}
          slug={team.slug}
          avatarUrl={team.avatar_url || ""}
          teamId={team.id}
          onSelect={onSelectOrg}
        />
      ))}
    </div>
  );
}

Organizations.Skeleton = () => (
  <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <div
        key={index}
        className="bg-card hover:bg-accent transition-colors flex flex-col rounded-lg animate-pulse"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="h-12 w-12 bg-card/75 rounded-lg"></div>
          <div className="h-4 w-32 bg-card/75 rounded-lg"></div>
          <div className="h-4 w-32 bg-card/75 rounded-lg"></div>
        </div>
        <div className="p-4 border-t border-border flex items-center">
          <div className="h-6 w-6 bg-card/75 rounded-full animate-pulse"></div>
          <div className="h-6 w-6 bg-card/75 rounded-full animate-pulse -ml-2"></div>
          <div className="h-6 w-6 bg-card/75 rounded-full animate-pulse -ml-2"></div>
        </div>
      </div>
    ))}
  </div>
);

Organizations.Error = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8">
    <Icon name="error" size={24} className="text-muted-foreground" />
    <div className="text-sm text-muted-foreground text-center">
      We couldn't load your organizations right now.
      <br />
      Please try again later.
    </div>
  </div>
);

Organizations.Empty = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8 w-full">
    <div className="text-sm text-muted-foreground text-center">
      No organizations found. Please create one first.
    </div>
  </div>
);

/**
 * SelectOrg
 *
 * UI for selecting an organization to create a project in
 */
function SelectOrg() {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [isCreating, setIsCreating] = useState(false);

  const initialInput = searchParams.get("initialInput") || "";
  const autoSend = searchParams.get("autoSend") === "true";

  const handleSelectOrg = useCallback(
    async (orgSlug: string) => {
      setIsCreating(true);
      try {
        // Create project with default name
        const projectName = "New Project";
        const baseSlug = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        // Create project with retry logic for slug collisions
        let project;
        let attempt = 0;
        const maxAttempts = 10;

        while (attempt < maxAttempts) {
          try {
            const slugToTry =
              attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
            project = await createProject.mutateAsync({
              org: orgSlug,
              slug: slugToTry,
              title: projectName,
            });
            break; // Success, exit loop
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            // Check if it's a slug collision error
            if (
              errorMsg.toLowerCase().includes("slug") &&
              (errorMsg.toLowerCase().includes("exists") ||
                errorMsg.toLowerCase().includes("already") ||
                errorMsg.toLowerCase().includes("taken") ||
                errorMsg.toLowerCase().includes("duplicate"))
            ) {
              attempt++;
              if (attempt >= maxAttempts) {
                throw new Error(
                  "Failed to create project: all slug attempts failed",
                );
              }
              // Try next attempt
              continue;
            }
            // Not a slug error, throw it
            throw err;
          }
        }

        if (!project) {
          throw new Error("Failed to create project");
        }

        // Clear onboarding params on success
        clearOnboardingParams();

        // Navigate to project with initialInput params
        const params = new URLSearchParams();
        if (initialInput) {
          params.set("initialInput", initialInput);
        }
        if (autoSend) {
          params.set("autoSend", "true");
        }

        const query = params.toString();
        const path =
          query.length > 0
            ? `/${orgSlug}/${project.slug}?${query}`
            : `/${orgSlug}/${project.slug}`;
        navigate(path);
      } catch (error) {
        console.error("Failed to create project:", error);
        if (error instanceof Error) {
          alert(`Failed to create project: ${error.message}`);
        }
      } finally {
        setIsCreating(false);
      }
    },
    [initialInput, autoSend, createProject, navigate],
  );

  const handleDismiss = useCallback(() => {
    // Clear onboarding params on dismiss
    clearOnboardingParams();
    navigate("/");
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      <div className="p-8 flex flex-col gap-4 w-full max-w-7xl mx-auto flex-1 overflow-hidden">
        <div className="rounded-xl border border-border bg-background p-4 flex items-center gap-2 shadow-xs">
          <div className="shrink-0 size-[60px] flex items-center justify-center">
            <Icon name="add_circle" size={60} className="text-primary" />
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <p className="text-base font-medium leading-6">
              Select an organization to create project
            </p>
            {initialInput && (
              <div className="border border-border rounded-lg flex items-center shrink-0 w-fit">
                <div className="border-r border-border px-2 py-1.5">
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    Initial prompt:
                  </p>
                </div>
                <div className="px-4 py-1.5">
                  <p className="text-sm text-foreground whitespace-nowrap max-w-md truncate">
                    {initialInput}
                  </p>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="shrink-0 h-8 rounded-xl"
            disabled={isCreating}
          >
            Dismiss
          </Button>
        </div>

        <div className="flex items-center justify-between mt-4">
          <h2 className="text-xl font-medium">My organizations</h2>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isCreating}
            />
          </div>
        </div>

        <div className="@container overflow-y-auto flex-1 pb-8 p-1 -m-1">
          <ErrorBoundary fallback={<Organizations.Error />}>
            <Suspense fallback={<Organizations.Skeleton />}>
              <Organizations
                query={deferredQuery}
                onSelectOrg={handleSelectOrg}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

/**
 * Onboarding Page Component
 *
 * Main entry point for /new route
 */
export function OnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const teams = useOrganizations({});
  const onboardingStatus = useOnboardingAnswers();

  // On mount, check if we need to restore params from localStorage
  useEffect(() => {
    const storedParams = restoreOnboardingParams();
    if (storedParams && Object.keys(storedParams).length > 0) {
      // Only restore if we don't already have params in URL
      const hasUrlParams = searchParams.has("initialInput");
      if (!hasUrlParams) {
        const newSearchParams = onboardingParamsToSearchParams(storedParams);
        setSearchParams(newSearchParams, { replace: true });
      }
    }
  }, []);

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

  // Handle redirect to home if not in onboarding flow
  useEffect(() => {
    if (state.type === "REDIRECT_HOME") {
      navigate("/", { replace: true });
    }
  }, [state.type, navigate]);

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
      return <SelectOrg />;

    case "REDIRECT_HOME":
      return null;
  }
}

export default OnboardingPage;
