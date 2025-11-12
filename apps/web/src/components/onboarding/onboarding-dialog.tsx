import {
  useAutoJoinTeam,
  useCreateTeam,
  useSaveOnboardingAnswers,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { useUser } from "../../hooks/use-user.ts";
import { findThemeByName } from "../theme-editor/theme-presets.ts";

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

const schema = z.object({
  role: z.string().min(1, "Please select your role"),
  companySize: z.string().min(1, "Please select company size"),
  useCase: z.string().min(1, "Please tell us what you're using deco for"),
});

type FormData = z.infer<typeof schema>;

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

interface OnboardingDialogProps {
  hasCompletedOnboarding: boolean;
}

export function OnboardingDialog({
  hasCompletedOnboarding,
}: OnboardingDialogProps) {
  const [searchParams] = useSearchParams();
  const user = useUser();
  const createTeam = useCreateTeam();
  const autoJoinTeam = useAutoJoinTeam();
  const saveAnswers = useSaveOnboardingAnswers();

  // Get theme from query params and look it up, fallback to undefined for default
  const themeParam = searchParams.get("theme");
  const selectedTheme = themeParam ? findThemeByName(themeParam) : undefined;

  // Track if auto org creation is in flight to prevent duplicate execution
  const isAutoCreatingRef = useRef(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "",
      companySize: "",
      useCase: "",
    },
  });

  const isCreatingOrg = createTeam.isPending || autoJoinTeam.isPending;

  // Background image (same as SplitScreenLayout)
  const bgImage =
    "url('https://assets.decocache.com/decocms/cbef38cc-a1fe-4616-bbb6-e928bfe334ef/capybara.png')";

  // Org creation/join logic (guarded)
  async function createOrJoinOrg(options?: { force?: boolean }) {
    // Guard: only auto-create when onboarding is completed,
    // unless explicitly forced after submitting the questionnaire.
    if (!hasCompletedOnboarding && !options?.force) {
      return;
    }
    const userEmail = user?.email || "";
    const domain = extractDomain(userEmail);
    const isWellKnownDomain = WELL_KNOWN_EMAIL_DOMAINS.has(domain);

    let team;

    if (isWellKnownDomain) {
      // Personal org for well-known domains
      const username = extractUsername(userEmail) || "user";
      const orgName = `${username} personal`;
      const baseSlug = `${username}-personal`;

      // Try base slug first, then with random suffix if collision
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
          // Retry with random 4-char suffix
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
      // Company org for custom domains
      const orgName = domainToCompanyName(domain) || "My Organization";

      // Try to auto-join existing org with this domain
      try {
        const result = await autoJoinTeam.mutateAsync(domain);
        if (result.success) {
          team = result.team;
        }
      } catch {
        // No existing org with this domain, create new one
        const baseSlug = nameToSlug(orgName);
        const avatarUrl = getLogoUrl(domain);

        // Try base slug first, then with random suffix if collision
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
            createErr instanceof Error ? createErr.message : String(createErr);
          const isSlugError =
            errorMsg.toLowerCase().includes("slug") ||
            errorMsg.toLowerCase().includes("already") ||
            errorMsg.toLowerCase().includes("duplicate");

          if (isSlugError) {
            // Retry with random 4-char suffix
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
  }

  // Form submission handler
  async function onSubmit(data: FormData) {
    // Guard against duplicate auto-create effect
    isAutoCreatingRef.current = true;
    try {
      // Save answers then create org
      await saveAnswers.mutateAsync({
        role: data.role,
        company_size: data.companySize,
        use_case: data.useCase,
      });
      await createOrJoinOrg({ force: true });
    } finally {
      isAutoCreatingRef.current = false;
    }
  }

  // Auto-create org if user has already completed onboarding
  useEffect(() => {
    if (
      hasCompletedOnboarding &&
      !isCreatingOrg &&
      !isAutoCreatingRef.current
    ) {
      isAutoCreatingRef.current = true;
      createOrJoinOrg().finally(() => {
        isAutoCreatingRef.current = false;
      });
    }
  }, [hasCompletedOnboarding, isCreatingOrg]);

  // If user has completed onboarding, show creating state
  if (hasCompletedOnboarding) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 lg:p-18 overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: bgImage,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          }}
        />
        {/* Green overlay */}
        <div className="absolute inset-0 bg-brand-green-dark/50 backdrop-blur-[2px] pointer-events-none" />

        {/* Centered content */}
        <div className="relative z-10 flex flex-col gap-4 items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-lg text-muted">Creating your organization...</p>
        </div>
      </div>
    );
  }

  // Show questions form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 lg:p-18 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: bgImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      />
      {/* Green overlay */}
      <div className="absolute inset-0 bg-brand-green-dark/50 backdrop-blur-[2px] pointer-events-none" />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-2xl flex flex-col gap-10 bg-background backdrop-blur border border-white/20 rounded-2xl p-8">
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
            {/* Role */}
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

            {/* Company Size */}
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

            {/* Use Case */}
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

            {/* Continue Button */}
            <div className="flex justify-end w-full">
              <Button
                type="submit"
                size="lg"
                disabled={saveAnswers.isPending || isCreatingOrg}
              >
                Continue
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
