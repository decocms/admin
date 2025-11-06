import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthConfig } from "@/web/providers/auth-config-provider";
import { authClient } from "@/web/lib/auth-client";

export function UnifiedAuthForm() {
  const { emailAndPassword, magicLink, socialProviders } = useAuthConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const magicLinkMutation = useMutation({
    mutationFn: async (email: string) => {
      await authClient.signIn.magicLink({ email });
    },
    onSuccess: () => {
      setEmail("");
    },
  });

  const emailPasswordMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      name,
    }: {
      email: string;
      password: string;
      name?: string;
    }) => {
      if (isSignUp) {
        await authClient.signUp.email({ email, password, name: name || "" });
      } else {
        await authClient.signIn.email({ email, password });
      }
    },
  });

  const socialSignInMutation = useMutation({
    mutationFn: async (providerId: string) => {
      await authClient.signIn.social({
        provider: providerId,
        callbackURL: window.location.origin,
      });
    },
  });

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    magicLinkMutation.mutate(email);
  };

  const handleEmailPassword = (e: React.FormEvent) => {
    e.preventDefault();
    emailPasswordMutation.mutate({ email, password, name });
  };

  const handleSocialSignIn = (providerId: string) => {
    socialSignInMutation.mutate(providerId);
  };

  const isLoading =
    magicLinkMutation.isPending ||
    emailPasswordMutation.isPending ||
    socialSignInMutation.isPending;

  const error =
    magicLinkMutation.error ||
    emailPasswordMutation.error ||
    socialSignInMutation.error;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-lg bg-card p-8 shadow-lg border">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          {isSignUp ? "Create an account" : "Welcome back"}
        </h1>
        <p className="text-muted-foreground">
          {isSignUp ? "Sign up to get started" : "Sign in to your account"}
        </p>
      </div>

      {/* Social providers */}
      {socialProviders.enabled && (
        <div className="space-y-3">
          {socialProviders.providers.map((provider) => (
            <button
              key={provider.name}
              onClick={() => handleSocialSignIn(provider.name)}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {provider.icon && (
                <img
                  src={provider.icon}
                  alt={provider.name}
                  className="h-5 w-5"
                />
              )}
              Continue with{" "}
              {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      {socialProviders.enabled &&
        (emailAndPassword.enabled || magicLink.enabled) && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
        )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "An error occurred"}
        </div>
      )}

      {/* Success message */}
      {magicLinkMutation.isSuccess && (
        <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
          Check your email for a magic link to sign in!
        </div>
      )}

      {/* Magic Link Form */}
      {magicLink.enabled && !emailAndPassword.enabled && (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {magicLinkMutation.isPending ? "Sending..." : "Send magic link"}
          </button>
        </form>
      )}

      {/* Email & Password Form */}
      {emailAndPassword.enabled && (
        <form onSubmit={handleEmailPassword} className="space-y-4">
          {isSignUp && (
            <div>
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emailPasswordMutation.isPending
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
                ? "Sign up"
                : "Sign in"}
          </button>

          <div className="space-y-2">
            {magicLink.enabled && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (email) {
                      handleMagicLink(e);
                    }
                  }}
                  disabled={isLoading || !email}
                  className="text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Or send me a magic link
                </button>
              </div>
            )}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                disabled={isLoading}
                className="text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Terms */}
      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
