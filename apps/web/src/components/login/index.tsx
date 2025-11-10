import { SplitScreenLayout } from "./layout.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { providers } from "./providers.tsx";
import { Link, useSearchParams, useNavigate } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useState, type FormEventHandler } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@deco/sdk/hooks";
import { useSendMagicLink } from "./hooks/use-send-magic-link.ts";

function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = searchParams.get("next");
  const cli = searchParams.has("cli");

  const [email, setEmail] = useState("");
  const sendMagicLink = useSendMagicLink();

  // Get only OAuth providers (exclude Email)
  const oauthProviders = providers.filter(
    (provider) => provider.name !== "Email",
  );

  const handleMagicLinkSubmit: FormEventHandler<HTMLFormElement> = async (
    e,
  ) => {
    e.preventDefault();

    trackEvent("deco_chat_login_provider_click", {
      provider: "Email",
    });

    await sendMagicLink.mutateAsync({
      email,
      cli: searchParams.get("cli") === "true",
    });

    // Navigate to confirmation page with email
    const params = new URLSearchParams();
    params.set("email", email);
    if (next) params.set("next", next);
    if (cli) params.set("cli", "true");
    navigate(`/login/magiclink?${params.toString()}`);
  };

  return (
    <SplitScreenLayout>
      <div className="h-full px-6 py-8 sm:px-10 sm:py-12 md:px-14 md:py-16 overflow-y-auto">
        <div className="flex flex-col gap-12 min-h-full justify-center">
          {/* Logo */}
          <div className="h-[26px] w-[62px]">
            <img
              src="/img/deco-logo.svg"
              alt="deco"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Main content */}
          <div className="flex flex-col gap-10">
            {/* Header */}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-medium">Welcome to deco</h1>
              <p className="text-base text-muted-foreground">
                Sign in or create a new account
              </p>
            </div>

            {/* Auth options */}
            <div className="flex flex-col gap-5">
              {/* OAuth buttons */}
              <div className="flex flex-col gap-2">
                {oauthProviders.map((provider) => (
                  <Button
                    key={provider.name}
                    variant="outline"
                    className="h-12 justify-center gap-3 rounded-xl"
                    asChild
                  >
                    <Link
                      to={provider.authURL({
                        next: next || globalThis.location.origin,
                        cli,
                      })}
                      onClick={() => {
                        trackEvent("deco_chat_login_provider_click", {
                          provider: provider.name,
                        });
                      }}
                    >
                      <img
                        className={provider.iconClassName}
                        loading="lazy"
                        src={provider.iconURL}
                        alt={provider.name}
                        width={20}
                        height={20}
                      />
                      <span className="text-sm font-medium">
                        Continue with {provider.name}
                      </span>
                    </Link>
                  </Button>
                ))}
              </div>

              {/* Divider with "or" */}
              <div className="flex items-center gap-2.5">
                <Separator className="flex-1" />
                <span className="text-base text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              {/* Email form */}
              {!cli && (
                <form
                  onSubmit={handleMagicLinkSubmit}
                  className="flex flex-col gap-2"
                >
                  <Input
                    type="email"
                    placeholder="Email address"
                    className="h-12 rounded-xl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    className="h-12 bg-primary text-primary-foreground rounded-xl gap-2"
                    disabled={sendMagicLink.isPending}
                  >
                    {sendMagicLink.isPending && <Spinner size="xs" />}
                    Send magic link
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Terms text */}
          <div className="flex justify-center">
            <p className="text-xs max-w-sm text-muted-foreground text-center leading-4">
              By continuing, you agree to deco's{" "}
              <a
                href="https://www.decocms.com/terms-of-use"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://www.decocms.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Privacy Policy
              </a>
              , and to receive periodic emails with updates.
            </p>
          </div>
        </div>
      </div>
    </SplitScreenLayout>
  );
}

export default function LoginWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <Login />
    </QueryClientProvider>
  );
}
